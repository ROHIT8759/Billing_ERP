import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureAccountingSetup,
  ensureCustomerAccount,
  ensureSupplierAccount,
  getSystemAccount,
  postJournalEntry,
} from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

// Local enums (these are not in Prisma schema — managed as plain strings in Prisma)
const VoucherType = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
} as const
type VoucherType = typeof VoucherType[keyof typeof VoucherType]

const PaymentMode = { CASH: 'CASH', BANK: 'BANK' } as const
type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode]

const AccountType = {
  CASH: 'CASH',
  BANK: 'BANK',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  EXPENSE: 'EXPENSE',
} as const
type AccountType = typeof AccountType[keyof typeof AccountType]

async function getCashOrBankAccount(shopId: string, paymentMode: PaymentMode) {
  return getSystemAccount(
    prisma,
    shopId,
    paymentMode === PaymentMode.BANK ? AccountType.BANK : AccountType.CASH
  )
}

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const voucherType = request.nextUrl.searchParams.get('voucherType') as VoucherType | null

    const entries = await prisma.journalEntry.findMany({
      where: {
        shopId: shop.id,
        ...(voucherType ? { voucherType } : {}),
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: {
            debit: 'desc',
          },
        },
      },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Transactions fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const body = await request.json()
    const {
      voucherType,
      counterpartyId,
      expenseAccountId,
      paymentMode,
      amount,
      reference,
      narration,
      entryDate,
    } = body

    const numericAmount = Number(amount || 0)
    if (!voucherType || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Voucher type and a valid amount are required' },
        { status: 400 }
      )
    }

    const entry = await prisma.$transaction(async (tx) => {
      const cashOrBank = await getSystemAccount(
        tx,
        shop.id,
        paymentMode === PaymentMode.BANK ? AccountType.BANK : AccountType.CASH
      )

      if (voucherType === VoucherType.RECEIPT) {
        if (!counterpartyId) {
          throw new Error('Customer is required for a receipt')
        }

        const customer = await tx.customer.findUnique({
          where: { id: counterpartyId },
          select: { id: true, name: true, shopId: true },
        })

        if (!customer || customer.shopId !== shop.id) {
          throw new Error('Customer not found')
        }

        const customerAccount = await ensureCustomerAccount(tx, shop.id, customer.id, customer.name)

        return postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.RECEIPT,
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          reference: reference || null,
          narration: narration || `Receipt from ${customer.name}`,
          lines: [
            { accountId: cashOrBank.id, debit: numericAmount },
            { accountId: customerAccount.id, credit: numericAmount },
          ],
        })
      }

      if (voucherType === VoucherType.PAYMENT) {
        if (!counterpartyId && !expenseAccountId) {
          throw new Error('Select a supplier or expense account for payment')
        }

        if (counterpartyId) {
          const supplier = await tx.supplier.findUnique({
            where: { id: counterpartyId },
            select: { id: true, name: true, shopId: true },
          })

          if (!supplier || supplier.shopId !== shop.id) {
            throw new Error('Supplier not found')
          }

          const supplierAccount = await ensureSupplierAccount(tx, shop.id, supplier.id, supplier.name)

          return postJournalEntry(tx, {
            shopId: shop.id,
            voucherType: VoucherType.PAYMENT,
            entryDate: entryDate ? new Date(entryDate) : new Date(),
            reference: reference || null,
            narration: narration || `Payment to ${supplier.name}`,
            lines: [
              { accountId: supplierAccount.id, debit: numericAmount },
              { accountId: cashOrBank.id, credit: numericAmount },
            ],
          })
        }

        const expenseAccount = await tx.account.findFirst({
          where: {
            id: expenseAccountId,
            shopId: shop.id,
          },
        })

        if (!expenseAccount) {
          throw new Error('Expense account not found')
        }

        return postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.PAYMENT,
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          reference: reference || null,
          narration: narration || `Expense payment for ${expenseAccount.name}`,
          lines: [
            { accountId: expenseAccount.id, debit: numericAmount },
            { accountId: cashOrBank.id, credit: numericAmount },
          ],
        })
      }

      if (voucherType === VoucherType.CREDIT_NOTE) {
        if (!counterpartyId) {
          throw new Error('Customer is required for a credit note')
        }

        const customer = await tx.customer.findUnique({
          where: { id: counterpartyId },
          select: { id: true, name: true, shopId: true },
        })

        if (!customer || customer.shopId !== shop.id) {
          throw new Error('Customer not found')
        }

        const customerAccount = await ensureCustomerAccount(tx, shop.id, customer.id, customer.name)
        const salesReturnAccount = await getSystemAccount(tx, shop.id, AccountType.SALES_RETURN)

        return postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.CREDIT_NOTE,
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          reference: reference || null,
          narration: narration || `Credit note for ${customer.name}`,
          lines: [
            { accountId: salesReturnAccount.id, debit: numericAmount },
            { accountId: customerAccount.id, credit: numericAmount },
          ],
        })
      }

      if (voucherType === VoucherType.DEBIT_NOTE) {
        if (!counterpartyId) {
          throw new Error('Supplier is required for a debit note')
        }

        const supplier = await tx.supplier.findUnique({
          where: { id: counterpartyId },
          select: { id: true, name: true, shopId: true },
        })

        if (!supplier || supplier.shopId !== shop.id) {
          throw new Error('Supplier not found')
        }

        const supplierAccount = await ensureSupplierAccount(tx, shop.id, supplier.id, supplier.name)
        const purchaseReturnAccount = await getSystemAccount(tx, shop.id, AccountType.PURCHASE_RETURN)

        return postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.DEBIT_NOTE,
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          reference: reference || null,
          narration: narration || `Debit note against ${supplier.name}`,
          lines: [
            { accountId: supplierAccount.id, debit: numericAmount },
            { accountId: purchaseReturnAccount.id, credit: numericAmount },
          ],
        })
      }

      throw new Error('Unsupported voucher type')
    })

    return NextResponse.json(entry)
  } catch (error: any) {
    console.error('Transaction posting error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

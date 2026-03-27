import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { AccountType, VoucherType } from '@prisma/client'
import {
  assertAllocationAmountValid,
  createInvoiceAllocation,
  ensureCustomerAccount,
  getSystemAccount,
  postJournalEntry,
  recomputeInvoicePaymentState,
} from '@/lib/accounting'

// PaymentMode is defined in schema but not used by any model field, so Prisma may not export it.
const PaymentMode = { CASH: 'CASH', BANK: 'BANK' } as const
type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode]
const invoicePaymentVoucherTypes: VoucherType[] = [VoucherType.RECEIPT, VoucherType.CREDIT_NOTE]

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = params
    const allocations = await prisma.invoiceAllocation.findMany({
      where: {
        shopId: shop.id,
        invoiceId: id,
      },
      include: {
        journalEntry: {
          select: {
            entryNo: true,
            voucherType: true,
            entryDate: true,
            reference: true,
          },
        },
      },
      orderBy: {
        allocatedAt: 'desc',
      },
    })

    return NextResponse.json(allocations)
  } catch (error: any) {
    console.error('Fetch invoice payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = params
    const body = await request.json()
    const {
      amount,
      voucherType = VoucherType.RECEIPT,
      paymentMode = PaymentMode.CASH,
      reference,
      narration,
      entryDate,
    } = body

    const numericAmount = Number(amount || 0)
    if (numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      )
    }

    if (!invoicePaymentVoucherTypes.includes(voucherType as VoucherType)) {
      return NextResponse.json(
        { error: 'Invalid voucher type for invoice payment' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, shopId: shop.id },
        include: { customer: true },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // 1. Validate amount against outstanding
      assertAllocationAmountValid(numericAmount, invoice.outstandingAmount)

      // 2. Build Journal Entry
      const customerAccount = await ensureCustomerAccount(
        tx,
        shop.id,
        invoice.customer.id,
        invoice.customer.name
      )

      let debitAccountId: string
      if (voucherType === VoucherType.RECEIPT) {
        const cashOrBank = await getSystemAccount(
          tx,
          shop.id,
          paymentMode === PaymentMode.BANK ? AccountType.BANK : AccountType.CASH
        )
        debitAccountId = cashOrBank.id
      } else {
        // CREDIT_NOTE
        const salesReturnAccount = await getSystemAccount(tx, shop.id, AccountType.SALES_RETURN)
        debitAccountId = salesReturnAccount.id
      }

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: voucherType as VoucherType,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        reference: reference || null,
        narration: narration || `Payment for Invoice ${invoice.invoiceNo || 'N/A'}`,
        sourceModel: 'Invoice',
        sourceId: invoice.id,
        lines: [
          { accountId: debitAccountId, debit: numericAmount },
          { accountId: customerAccount.id, credit: numericAmount },
        ],
      })

      // 3. Create allocation
      const allocation = await createInvoiceAllocation(tx, {
        shopId: shop.id,
        invoiceId: invoice.id,
        journalEntryId: journalEntry.id,
        amount: numericAmount,
        allocatedAt: entryDate ? new Date(entryDate) : new Date(),
      })

      // 4. Recompute invoice lifecycle
      const updatedInvoice = await recomputeInvoicePaymentState(tx, invoice.id)

      return { invoice: updatedInvoice, journalEntry, allocation }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Record invoice payment error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

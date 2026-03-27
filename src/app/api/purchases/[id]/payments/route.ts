import { NextRequest, NextResponse } from 'next/server'
import { AccountType, VoucherType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import {
  assertAllocationAmountValid,
  createPurchaseAllocation,
  ensureSupplierAccount,
  getSystemAccount,
  postJournalEntry,
  recomputePurchasePaymentState,
} from '@/lib/accounting'

const PaymentMode = { CASH: 'CASH', BANK: 'BANK' } as const
type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode]
const purchasePaymentVoucherTypes: VoucherType[] = [VoucherType.PAYMENT, VoucherType.DEBIT_NOTE]

type PurchasePaymentRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  context: PurchasePaymentRouteContext
) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = await context.params
    const allocations = await prisma.purchaseAllocation.findMany({
      where: {
        shopId: shop.id,
        purchaseId: id,
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
    console.error('Fetch purchase payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: PurchasePaymentRouteContext
) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = await context.params
    const body = await request.json()
    const {
      amount,
      voucherType = VoucherType.PAYMENT,
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

    if (!purchasePaymentVoucherTypes.includes(voucherType as VoucherType)) {
      return NextResponse.json(
        { error: 'Invalid voucher type for purchase payment' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id, shopId: shop.id },
        include: { supplier: true },
      })

      if (!purchase) {
        throw new Error('Purchase not found')
      }

      if (!purchase.supplier) {
        throw new Error('Purchase supplier not found')
      }

      assertAllocationAmountValid(numericAmount, purchase.outstandingAmount)

      const supplierAccount = await ensureSupplierAccount(
        tx,
        shop.id,
        purchase.supplier.id,
        purchase.supplier.name
      )

      let creditAccountId: string
      if (voucherType === VoucherType.PAYMENT) {
        const cashOrBank = await getSystemAccount(
          tx,
          shop.id,
          paymentMode === PaymentMode.BANK ? AccountType.BANK : AccountType.CASH
        )
        creditAccountId = cashOrBank.id
      } else {
        const purchaseReturnAccount = await getSystemAccount(
          tx,
          shop.id,
          AccountType.PURCHASE_RETURN
        )
        creditAccountId = purchaseReturnAccount.id
      }

      const effectiveEntryDate = entryDate ? new Date(entryDate) : new Date()
      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: voucherType as VoucherType,
        entryDate: effectiveEntryDate,
        reference: reference || purchase.billNo || purchase.vendorName,
        narration:
          narration ||
          (voucherType === VoucherType.PAYMENT
            ? `Payment for purchase ${purchase.billNo || purchase.id}`
            : `Debit note for purchase ${purchase.billNo || purchase.id}`),
        sourceModel: 'Purchase',
        sourceId: purchase.id,
        lines: [
          { accountId: supplierAccount.id, debit: numericAmount },
          { accountId: creditAccountId, credit: numericAmount },
        ],
      })

      const allocation = await createPurchaseAllocation(tx, {
        shopId: shop.id,
        purchaseId: purchase.id,
        journalEntryId: journalEntry.id,
        amount: numericAmount,
        allocatedAt: effectiveEntryDate,
      })

      const updatedPurchase = await recomputePurchasePaymentState(tx, purchase.id)

      return { purchase: updatedPurchase, journalEntry, allocation }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Record purchase payment error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

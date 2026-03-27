import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { AccountType, VoucherType } from '@prisma/client'
import {
  createPurchaseAllocation,
  ensureAccountingSetup,
  ensureSupplierAccount,
  getSystemAccount,
  postJournalEntry,
  recomputePurchasePaymentState,
} from '@/lib/accounting'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        purchase: true,
        items: true,
      },
    })

    return NextResponse.json(purchaseReturns)
  } catch (error: any) {
    console.error('Fetch purchase returns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const body = await request.json()
    const { purchaseId, items, reason, totalAmount } = body

    if (!purchaseId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Purchase ID and at least one item are required' }, { status: 400 })
    }

    const numericTotal = Number(totalAmount || 0)
    if (numericTotal <= 0) {
      return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 })
    }

    const count = await prisma.purchaseReturn.count({ where: { shopId: shop.id } })
    const noteNo = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId, shopId: shop.id },
        include: { supplier: true },
      })

      if (!purchase || !purchase.supplierId || !purchase.supplier) {
        throw new Error('Purchase or attached Supplier not found')
      }

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          shopId: shop.id,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          noteNo,
          reason: reason || null,
          totalAmount: numericTotal,
          items: {
            create: items.map((item: any) => ({
              purchaseItemId: item.purchaseItemId || null,
              productId: item.productId,
              batchId: item.batchId || null,
              quantity: Number(item.quantity),
              rate: Number(item.rate),
              amount: Number(item.amount),
            })),
          },
        },
        include: { items: true },
      })

      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: Number(item.quantity) } },
          })
        }
      }

      const supplierAccount = await ensureSupplierAccount(
        tx,
        shop.id,
        purchase.supplier.id,
        purchase.supplier.name
      )
      const purchaseReturnAccount = await getSystemAccount(tx, shop.id, AccountType.PURCHASE_RETURN)

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.DEBIT_NOTE,
        reference: noteNo,
        narration: `Purchase Return against Bill ${purchase.billNo || purchase.id}`,
        sourceModel: 'PurchaseReturn',
        sourceId: purchaseReturn.id,
        lines: [
          { accountId: supplierAccount.id, debit: numericTotal },
          { accountId: purchaseReturnAccount.id, credit: numericTotal },
        ],
      })

      await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: { journalEntryId: journalEntry.id },
      })

      await createPurchaseAllocation(tx, {
        shopId: shop.id,
        purchaseId: purchase.id,
        journalEntryId: journalEntry.id,
        amount: numericTotal,
      })

      await recomputePurchasePaymentState(tx, purchase.id)

      return purchaseReturn
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Create purchase return error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

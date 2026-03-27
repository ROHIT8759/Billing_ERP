import { NextRequest, NextResponse } from 'next/server'
import { AccountType, VoucherType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import {
  createPurchaseAllocation,
  ensureSupplierAccount,
  getSystemAccount,
  postJournalEntry,
  recomputePurchasePaymentState,
} from '@/lib/accounting'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function nextDebitNoteNo(shopId: string) {
  const count = await prisma.purchaseReturn.count({ where: { shopId } })
  return `DBN-${String(count + 1).padStart(5, '0')}`
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const notes = await prisma.purchaseReturn.findMany({
      where: { shopId: shop.id, purchaseId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
      },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Debit note fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { items, reason, entryDate, reference } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one return item is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id, shopId: shop.id },
        include: {
          supplier: true,
          items: true,
        },
      })

      if (!purchase) {
        throw new Error('Purchase not found')
      }

      if (!purchase.supplier) {
        throw new Error('Supplier not found')
      }

      const supplierAccount = await ensureSupplierAccount(
        tx,
        shop.id,
        purchase.supplier.id,
        purchase.supplier.name
      )
      const purchaseReturnAccount = await getSystemAccount(tx, shop.id, AccountType.PURCHASE_RETURN)
      const effectiveEntryDate = entryDate ? new Date(entryDate) : new Date()

      const preparedItems = []
      let totalAmount = 0

      for (const inputItem of items as Array<{ batchId?: string; purchaseItemId?: string; quantity: number | string }>) {
        const quantity = Number(inputItem.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Return quantity must be greater than zero')
        }

        let purchaseItem = inputItem.purchaseItemId
          ? purchase.items.find((item) => item.id === inputItem.purchaseItemId)
          : null

        let batch = null
        if (inputItem.batchId) {
          batch = await tx.batch.findUnique({
            where: { id: inputItem.batchId },
            include: {
              product: true,
            },
          })

          if (!batch || batch.shopId !== shop.id || batch.purchaseId !== purchase.id) {
            throw new Error('Batch not found for this purchase')
          }

          if (quantity > batch.quantity) {
            throw new Error(`Return quantity exceeds available batch stock for ${batch.product.name}`)
          }

          if (!purchaseItem) {
            purchaseItem =
              purchase.items.find((item) => item.productName.toLowerCase() === batch.product.name.toLowerCase()) ||
              null
          }
        }

        if (!purchaseItem && !batch) {
          throw new Error('Each return item requires a purchase item or batch')
        }

        const product =
          batch?.product ||
          (purchaseItem
            ? await tx.product.findFirst({
                where: {
                  shopId: shop.id,
                  name: { equals: purchaseItem.productName, mode: 'insensitive' },
                },
              })
            : null)

        if (!product) {
          throw new Error('Matching product not found for return item')
        }

        const existingReturns = await tx.purchaseReturnItem.aggregate({
          where: {
            purchaseItemId: purchaseItem?.id || undefined,
            batchId: batch?.id || undefined,
            purchaseReturn: {
              shopId: shop.id,
            },
          },
          _sum: {
            quantity: true,
          },
        })

        const alreadyReturned = Number(existingReturns._sum.quantity || 0)
        const availableQuantity = batch
          ? batch.quantity
          : purchaseItem
            ? purchaseItem.quantity - alreadyReturned
            : 0

        if (quantity > availableQuantity) {
          throw new Error(`Return quantity exceeds available quantity for ${product.name}`)
        }

        const rate = purchaseItem?.price || 0
        const amount = Number((rate * quantity).toFixed(2))
        totalAmount += amount
        preparedItems.push({
          purchaseItemId: purchaseItem?.id || null,
          productId: product.id,
          batchId: batch?.id || null,
          quantity,
          rate,
          amount,
          batchGodownId: batch?.godownId || null,
        })
      }

      if (totalAmount > purchase.outstandingAmount) {
        throw new Error('Debit note amount cannot exceed current outstanding balance')
      }

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.DEBIT_NOTE,
        entryDate: effectiveEntryDate,
        reference: reference || purchase.billNo || purchase.vendorName,
        narration: reason || `Debit note against purchase ${purchase.billNo || purchase.id}`,
        sourceModel: 'Purchase',
        sourceId: purchase.id,
        lines: [
          { accountId: supplierAccount.id, debit: totalAmount },
          { accountId: purchaseReturnAccount.id, credit: totalAmount },
        ],
      })

      const note = await tx.purchaseReturn.create({
        data: {
          shopId: shop.id,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId!,
          journalEntryId: journalEntry.id,
          noteNo: await nextDebitNoteNo(shop.id),
          reason: reason || null,
          totalAmount,
          createdAt: effectiveEntryDate,
          items: {
            create: preparedItems.map(({ batchGodownId, ...item }) => item),
          },
        },
        include: {
          items: true,
        },
      })

      for (const item of preparedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        if (item.batchId) {
          await tx.batch.update({
            where: { id: item.batchId },
            data: { quantity: { decrement: item.quantity } },
          })
        }

        if (item.batchGodownId) {
          await tx.godownStock.updateMany({
            where: {
              godownId: item.batchGodownId,
              productId: item.productId,
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          })
        }
      }

      await createPurchaseAllocation(tx, {
        shopId: shop.id,
        purchaseId: purchase.id,
        journalEntryId: journalEntry.id,
        amount: totalAmount,
        allocatedAt: effectiveEntryDate,
      })

      const updatedPurchase = await recomputePurchasePaymentState(tx, purchase.id)

      return { note, journalEntry, purchase: updatedPurchase }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Debit note creation error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

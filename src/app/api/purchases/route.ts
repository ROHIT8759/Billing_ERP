import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountType, VoucherType } from '@prisma/client'
import {
  createPurchaseAllocation,
  ensureAccountingSetup,
  ensureSupplierAccount,
  findOrCreateSupplier,
  getSystemAccount,
  postJournalEntry,
  recomputePurchasePaymentState,
} from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const purchases = await prisma.purchase.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        items: true,
      }
    })

    return NextResponse.json(purchases)
  } catch (error: any) {
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
      supplierId,
      vendorName,
      items,
      totalAmount,
      imageUrl,
      billNo,
      dueDate,
      paymentTermDays,
      initialPaymentAmount,
      paymentMode,
    } = body

    if ((!supplierId && !vendorName) || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Supplier or vendor name and at least one item are required' },
        { status: 400 }
      )
    }

    const createdDate = new Date()
    const totalAmountValue = Number.parseFloat(totalAmount)
    const initialPaymentAmountValue = Number.parseFloat(initialPaymentAmount || 0)
    const paymentTermDaysValue = Number.parseInt(paymentTermDays, 10)

    if (!Number.isFinite(totalAmountValue) || totalAmountValue <= 0) {
      return NextResponse.json({ error: 'A valid total amount is required' }, { status: 400 })
    }

    if (!Number.isFinite(initialPaymentAmountValue) || initialPaymentAmountValue < 0) {
      return NextResponse.json(
        { error: 'Initial payment amount must be zero or greater' },
        { status: 400 }
      )
    }

    if (initialPaymentAmountValue > totalAmountValue) {
      return NextResponse.json(
        { error: 'Initial payment amount cannot exceed total amount' },
        { status: 400 }
      )
    }

    let computedDueDate: Date | null = null
    if (dueDate) {
      const parsedDueDate = new Date(dueDate)
      if (Number.isNaN(parsedDueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
      }
      computedDueDate = parsedDueDate
    } else if (Number.isFinite(paymentTermDaysValue) && paymentTermDaysValue > 0) {
      computedDueDate = new Date(createdDate)
      computedDueDate.setDate(computedDueDate.getDate() + paymentTermDaysValue)
    }

    // Use transaction to create purchase, items, and increment stock
    const purchase = await prisma.$transaction(async (tx) => {
      let supplier: { id: string; name: string; shopId: string }
      let supplierAccount: { id: string }

      if (supplierId) {
        const existingSupplier = await tx.supplier.findUnique({
          where: { id: supplierId },
        })

        if (!existingSupplier || existingSupplier.shopId !== shop.id) {
          throw new Error('Supplier not found')
        }

        supplier = existingSupplier
        supplierAccount = await ensureSupplierAccount(tx, shop.id, supplier.id, supplier.name)
      } else {
        const createdSupplier = await findOrCreateSupplier(tx, shop.id, vendorName)
        supplier = createdSupplier.supplier
        supplierAccount = createdSupplier.account
      }

      const purchaseAccount = await getSystemAccount(tx, shop.id, AccountType.PURCHASE)
      const cashOrBankAccount = initialPaymentAmountValue > 0
        ? await getSystemAccount(
            tx,
            shop.id,
            paymentMode === 'BANK' ? AccountType.BANK : AccountType.CASH
          )
        : null
      const normalizedVendorName = supplier.name

      // 1. Create Purchase
      const newPurchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          billNo: billNo?.trim() || null,
          vendorName: normalizedVendorName,
          totalAmount: totalAmountValue,
          dueDate: computedDueDate,
          paidAmount: 0,
          outstandingAmount: totalAmountValue,
          paymentStatus: 'UNPAID',
          imageUrl: imageUrl || null,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId || null,
              productName: item.productName || item.name || 'Unknown Item',
              batchNo: item.batchNo?.trim() || null,
              pack: item.pack?.trim() || null,
              quantity: parseInt(item.quantity, 10),
              freeQty: parseInt(item.freeQty || item.free || 0, 10),
              price: parseFloat(item.price),
              discountPct: parseFloat(item.discountPct || item.discount || 0),
              amount: parseFloat(item.amount || 0),
            }))
          }
        },
        include: { items: true }
      })

      // 2. Increment stock: use productId if provided, else fall back to name match
      for (const item of items) {
        const qty = parseInt(item.quantity, 10)
        const freeQty = parseInt(item.freeQty || item.free || 0, 10)
        const totalQty = qty + freeQty
        if (totalQty <= 0) continue

        if (item.productId) {
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, id: item.productId }
          })
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { increment: totalQty } }
            })
          }
        } else if (item.productName) {
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, name: { equals: item.productName, mode: 'insensitive' } }
          })
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { increment: totalQty } }
            })
          }
        }
      }

      await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.PURCHASE,
        entryDate: newPurchase.createdAt,
        reference: billNo?.trim() || supplier.name,
        narration: `Purchase from ${supplier.name}`,
        sourceModel: 'Purchase',
        sourceId: newPurchase.id,
        lines: [
          {
            accountId: purchaseAccount.id,
            debit: Number(newPurchase.totalAmount),
          },
          {
            accountId: supplierAccount.id,
            credit: Number(newPurchase.totalAmount),
          },
        ],
      })

      if (initialPaymentAmountValue > 0 && cashOrBankAccount) {
        const paymentEntry = await postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.PAYMENT,
          entryDate: newPurchase.createdAt,
          reference: billNo?.trim() || supplier.name,
          narration: `Payment against purchase ${billNo?.trim() || newPurchase.id} to ${supplier.name}`,
          sourceModel: 'Purchase',
          sourceId: newPurchase.id,
          lines: [
            {
              accountId: supplierAccount.id,
              debit: initialPaymentAmountValue,
            },
            {
              accountId: cashOrBankAccount.id,
              credit: initialPaymentAmountValue,
            },
          ],
        })

        await createPurchaseAllocation(tx, {
          shopId: shop.id,
          purchaseId: newPurchase.id,
          journalEntryId: paymentEntry.id,
          amount: initialPaymentAmountValue,
          allocatedAt: newPurchase.createdAt,
        })

        await recomputePurchasePaymentState(tx, newPurchase.id)
      }

      return tx.purchase.findUniqueOrThrow({
        where: { id: newPurchase.id },
        include: {
          supplier: true,
          items: true,
        },
      })
    })

    return NextResponse.json(purchase)
  } catch (error: any) {
    console.error('Purchase creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

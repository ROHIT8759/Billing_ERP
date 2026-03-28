import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountType, VoucherType } from '@prisma/client'
import {
  ensureAccountingSetup,
  findOrCreateSupplier,
  getSystemAccount,
  postJournalEntry,
  recomputePurchasePaymentState,
  createPurchaseAllocation,
} from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

interface ScanItem {
  name: string
  quantity: number
  freeQty?: number
  price: number
  discountPct?: number
  batchNo?: string | null
  pack?: string | null
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const body = await request.json()
    const {
      vendorName,
      billNo,
      items,
      totalAmount,
      imageUrl,
      initialPaymentAmount,
      paymentMode,
    }: {
      vendorName: string
      billNo?: string | null
      items: ScanItem[]
      totalAmount: number
      imageUrl?: string | null
      initialPaymentAmount?: number
      paymentMode?: string
    } = body

    if (!vendorName) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    const totalAmountValue = Number(totalAmount)
    if (!Number.isFinite(totalAmountValue) || totalAmountValue <= 0) {
      return NextResponse.json({ error: 'Valid total amount is required' }, { status: 400 })
    }

    const initialPaymentAmountValue = Number(initialPaymentAmount || 0)
    const createdProductNames: string[] = []

    // Resolve products and create missing ones outside transaction first
    // (to avoid long transactions; we'll re-verify inside)
    const resolvedItems: (ScanItem & { productId: string | null })[] = []

    for (const item of items) {
      const productName = item.name?.trim()
      if (!productName) {
        resolvedItems.push({ ...item, productId: null })
        continue
      }

      // Try to find existing product by exact name (case insensitive)
      let product = await prisma.product.findFirst({
        where: {
          shopId: shop.id,
          name: { equals: productName, mode: 'insensitive' },
        },
        select: { id: true },
      })

      if (!product) {
        // Auto-create product
        product = await prisma.product.create({
          data: {
            shopId: shop.id,
            name: productName,
            price: item.price || 0,
            stock: 0,
            category: 'Uncategorized',
          },
          select: { id: true },
        })
        createdProductNames.push(productName)
      }

      resolvedItems.push({ ...item, productId: product.id })
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const { supplier, account: supplierAccount } = await findOrCreateSupplier(
        tx,
        shop.id,
        vendorName
      )

      const purchaseAccount = await getSystemAccount(tx, shop.id, AccountType.PURCHASE)
      const cashOrBankAccount =
        initialPaymentAmountValue > 0
          ? await getSystemAccount(
              tx,
              shop.id,
              paymentMode === 'BANK' ? AccountType.BANK : AccountType.CASH
            )
          : null

      const newPurchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          billNo: billNo?.trim() || null,
          vendorName: supplier.name,
          totalAmount: totalAmountValue,
          paidAmount: 0,
          outstandingAmount: totalAmountValue,
          paymentStatus: 'UNPAID',
          imageUrl: imageUrl || null,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId || null,
              productName: item.name?.trim() || 'Unknown Item',
              batchNo: item.batchNo?.trim() || null,
              pack: item.pack?.trim() || null,
              quantity: Math.max(1, Math.round(item.quantity || 1)),
              freeQty: Math.round(item.freeQty || 0),
              price: Number(item.price) || 0,
              discountPct: Number(item.discountPct) || 0,
              amount:
                Number(item.price) *
                Math.max(1, Math.round(item.quantity || 1)) *
                (1 - (Number(item.discountPct) || 0) / 100),
            })),
          },
        },
        include: { items: true },
      })

      // Increment stock for resolved items
      for (const item of resolvedItems) {
        if (!item.productId) continue
        const qty = Math.max(1, Math.round(item.quantity || 1))
        const free = Math.round(item.freeQty || 0)
        const totalQty = qty + free
        if (totalQty > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: totalQty } },
          })
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
          { accountId: purchaseAccount.id, debit: totalAmountValue },
          { accountId: supplierAccount.id, credit: totalAmountValue },
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
            { accountId: supplierAccount.id, debit: initialPaymentAmountValue },
            { accountId: cashOrBankAccount.id, credit: initialPaymentAmountValue },
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
        include: { supplier: true, items: true },
      })
    })

    return NextResponse.json({ purchase, createdProducts: createdProductNames })
  } catch (error: any) {
    console.error('Scan create error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

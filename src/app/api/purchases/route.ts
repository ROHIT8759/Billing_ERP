import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountType, VoucherType } from '@prisma/client'
import {
  ensureAccountingSetup,
  ensureSupplierAccount,
  findOrCreateSupplier,
  getSystemAccount,
  postJournalEntry,
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
    const { supplierId, vendorName, items, totalAmount, imageUrl } = body

    if ((!supplierId && !vendorName) || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Supplier or vendor name and at least one item are required' },
        { status: 400 }
      )
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
      const normalizedVendorName = supplier.name

      // 1. Create Purchase
      const newPurchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          vendorName: normalizedVendorName,
          totalAmount: parseFloat(totalAmount),
          imageUrl: imageUrl || null,
          items: {
            create: items.map((item: any) => ({
              productName: item.productName || item.name || 'Unknown Item',
              quantity: parseInt(item.quantity, 10),
              price: parseFloat(item.price)
            }))
          }
        },
        include: { items: true }
      })

      // 2. We can try to match product names to increment stock, but since this is manual
      // or OCR based, the product name might not exactly match what's in the DB.
      // So we'll skip automatic stock increment for unlinked manual purchases unless linked via a proper product picker.
      // Evolving logic: If the user provides an exact match, update stock
      for (const item of items) {
        if (item.productName) {
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, name: { equals: item.productName, mode: 'insensitive' } }
          })
          if (product) {
             await tx.product.update({
               where: { id: product.id },
               data: { stock: { increment: parseInt(item.quantity, 10) } }
             })
          }
        }
      }

      await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.PURCHASE,
        entryDate: newPurchase.createdAt,
        reference: supplier.name,
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

      return newPurchase
    })

    return NextResponse.json(purchase)
  } catch (error: any) {
    console.error('Purchase creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

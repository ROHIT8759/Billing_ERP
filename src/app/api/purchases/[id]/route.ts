import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteJournalEntriesForSource } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      select: {
        id: true,
        shopId: true,
        supplierId: true,
        billNo: true,
        vendorName: true,
        totalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        paymentStatus: true,
        dueDate: true,
        lastPaymentAt: true,
        imageUrl: true,
        createdAt: true,
        supplier: true,
        items: true,
      }
    })

    if (!purchase || purchase.shopId !== shop.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    return NextResponse.json(purchase)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.purchase.findUnique({ where: { id }, include: { items: true } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // Optional: Return stock to products when deleting a purchase?
    // We'll reverse the operation we did on create
    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const totalQty = item.quantity + (item.freeQty ?? 0)
        if (totalQty <= 0) continue

        if (item.productId) {
          await tx.product.updateMany({
            where: { shopId: shop.id, id: item.productId },
            data: { stock: { decrement: totalQty } }
          })
        } else if (item.productName) {
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, name: { equals: item.productName, mode: 'insensitive' } }
          })
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { decrement: totalQty } }
            })
          }
        }
      }
      await deleteJournalEntriesForSource(tx, shop.id, 'Purchase', id)
      await tx.purchase.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

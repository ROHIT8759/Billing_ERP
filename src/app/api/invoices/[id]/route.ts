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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        shopId: true,
        customerId: true,
        invoiceNo: true,
        totalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        paymentStatus: true,
        dueDate: true,
        lastPaymentAt: true,
        subtotal: true,
        discountAmount: true,
        discountType: true,
        gstAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        status: true,
        createdAt: true,
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        shop: true
      }
    })

    if (!invoice || invoice.shopId !== shop.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
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

    const existing = await prisma.invoice.findUnique({ where: { id }, include: { items: true } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Optional: Return stock to products when deleting an invoice?
    // Doing it for complete robustness
    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
      }
      await deleteJournalEntriesForSource(tx, shop.id, 'Invoice', id)
      await tx.invoice.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

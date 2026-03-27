import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function authorize(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
  if (!shop) return null
  const order = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!order || order.shopId !== shop.id) return null
  return { shop, order }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { vendorName, status, notes, items } = await request.json()

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
      }

      const totalAmount = items
        ? items.reduce((s: number, i: { quantity: number; price: number }) => s + i.quantity * i.price, 0)
        : auth.order.totalAmount

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          vendorName: vendorName?.trim() ?? auth.order.vendorName,
          status: status ?? auth.order.status,
          notes: notes !== undefined ? (notes?.trim() || null) : auth.order.notes,
          totalAmount,
          ...(items && {
            items: {
              create: items.map((item: { productId?: string; productName: string; quantity: number; price: number }) => ({
                productId: item.productId || null,
                productName: item.productName,
                quantity: parseInt(String(item.quantity)),
                price: parseFloat(String(item.price))
              }))
            }
          })
        },
        include: { items: { include: { product: { select: { id: true, name: true } } } } }
      })
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await prisma.purchaseOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

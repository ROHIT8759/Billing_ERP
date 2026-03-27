import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Convert an approved PO into a Purchase and increment stock */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!po || po.shopId !== shop.id) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
    if (po.status === 'received') return NextResponse.json({ error: 'PO already received' }, { status: 400 })

    const purchase = await prisma.$transaction(async (tx) => {
      // Create the Purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          vendorName: po.vendorName || 'PO Vendor',
          totalAmount: po.totalAmount,
          items: {
            create: po.items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              price: item.price
            }))
          }
        },
        include: { items: true }
      })

      // Increment stock for matched products
      for (const item of po.items) {
        const productId = item.productId
        if (productId) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: item.quantity } }
          })
        } else {
          // Fuzzy match by name
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, name: { equals: item.productName, mode: 'insensitive' } }
          })
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: { stock: { increment: item.quantity } }
            })
          }
        }
      }

      // Mark PO as received
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'received' } })

      return newPurchase
    })

    return NextResponse.json({ purchase, message: 'PO received and stock updated' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

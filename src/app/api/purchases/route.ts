import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const purchases = await prisma.purchase.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
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
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { vendorName, items, totalAmount, imageUrl } = body

    if (!vendorName || !items || items.length === 0) {
      return NextResponse.json({ error: 'Vendor Name and at least one item are required' }, { status: 400 })
    }

    // Use transaction to create purchase, items, and increment stock
    const purchase = await prisma.$transaction(async (tx: any) => {
      // 1. Create Purchase
      const newPurchase = await tx.purchase.create({
        data: {
          shopId: shop.id,
          vendorName,
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

      return newPurchase
    })

    return NextResponse.json(purchase)
  } catch (error: any) {
    console.error('Purchase creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

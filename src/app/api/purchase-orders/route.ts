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
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const orders = await prisma.purchaseOrder.findMany({
      where: { shopId: shop.id },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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

    const { vendorName, items, notes, status } = await request.json()
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    const totalAmount = items.reduce((sum: number, i: { quantity: number; price: number }) => sum + i.quantity * i.price, 0)

    // Auto-generate PO number
    const count = await prisma.purchaseOrder.count({ where: { shopId: shop.id } })
    const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`

    const order = await prisma.purchaseOrder.create({
      data: {
        shopId: shop.id,
        poNumber,
        vendorName: vendorName?.trim() || '',
        totalAmount,
        notes: notes?.trim() || null,
        status: status || 'draft',
        items: {
          create: items.map((item: { productId?: string; productName: string; quantity: number; price: number }) => ({
            productId: item.productId || null,
            productName: item.productName,
            quantity: parseInt(String(item.quantity)),
            price: parseFloat(String(item.price))
          }))
        }
      },
      include: { items: { include: { product: { select: { id: true, name: true } } } } }
    })

    return NextResponse.json(order)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify product belongs to user's shop
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, category, price, stock, reorderLevel, barcode, hsnCode, gstRate } = body

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        category: category || null,
        price: price !== undefined ? parseFloat(price.toString()) : undefined,
        stock: stock !== undefined ? parseInt(stock.toString(), 10) : undefined,
        reorderLevel: reorderLevel !== undefined ? (reorderLevel === '' || reorderLevel === null ? null : parseInt(reorderLevel.toString(), 10)) : undefined,
        barcode: barcode !== undefined ? (barcode?.trim() || null) : undefined,
        hsnCode: hsnCode !== undefined ? (hsnCode?.trim() || null) : undefined,
        gstRate: gstRate !== undefined ? parseFloat(gstRate.toString()) : undefined,
      }
    })

    return NextResponse.json(product)
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

    // Verify product belongs to user's shop
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

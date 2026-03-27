import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const godownId = searchParams.get('godownId')
    const expiringDays = searchParams.get('expiringDays')

    const where: Record<string, unknown> = { shopId: shop.id }
    if (productId) where.productId = productId
    if (godownId) where.godownId = godownId
    if (expiringDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + parseInt(expiringDays))
      where.expiryDate = { lte: cutoff }
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, category: true } },
        godown: { select: { id: true, name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }]
    })

    return NextResponse.json(batches)
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

    const { productId, godownId, batchNumber, mfgDate, expiryDate, quantity, purchaseId } = await request.json()
    if (!productId || !batchNumber?.trim() || quantity == null) {
      return NextResponse.json({ error: 'productId, batchNumber, and quantity are required' }, { status: 400 })
    }

    // Verify product belongs to shop
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product || product.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const batch = await prisma.$transaction(async (tx) => {
      const newBatch = await tx.batch.create({
        data: {
          shopId: shop.id,
          productId,
          godownId: godownId || null,
          purchaseId: purchaseId || null,
          batchNumber: batchNumber.trim(),
          mfgDate: mfgDate ? new Date(mfgDate) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          quantity: parseInt(quantity)
        },
        include: {
          product: { select: { id: true, name: true } },
          godown: { select: { id: true, name: true } },
        }
      })

      // Also update godown stock if godownId given
      if (godownId) {
        await tx.godownStock.upsert({
          where: { godownId_productId: { godownId, productId } },
          update: { quantity: { increment: parseInt(quantity) } },
          create: { godownId, productId, quantity: parseInt(quantity) }
        })
      }

      return newBatch
    })

    return NextResponse.json(batch)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

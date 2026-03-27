import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const schemes = await prisma.salesScheme.findMany({
      where: { shopId: shop.id },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(schemes)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { productId, name, type, minQty, freeQty, discountPct, startDate, endDate, isActive } = body

    if (!productId || !name || !minQty) {
      return NextResponse.json({ error: 'productId, name, and minQty are required' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product || product.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const scheme = await prisma.salesScheme.create({
      data: {
        shopId: shop.id,
        productId,
        name: String(name).trim(),
        type: type || 'FREE_QTY',
        minQty: parseInt(String(minQty), 10),
        freeQty: freeQty ? parseInt(String(freeQty), 10) : 0,
        discountPct: discountPct ? parseFloat(String(discountPct)) : 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== false,
      },
      include: { product: { select: { id: true, name: true } } },
    })

    return NextResponse.json(scheme, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.salesScheme.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, type, minQty, freeQty, discountPct, startDate, endDate, isActive } = body

    const scheme = await prisma.salesScheme.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        type: type !== undefined ? type : undefined,
        minQty: minQty !== undefined ? parseInt(String(minQty), 10) : undefined,
        freeQty: freeQty !== undefined ? parseInt(String(freeQty), 10) : undefined,
        discountPct: discountPct !== undefined ? parseFloat(String(discountPct)) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: { product: { select: { id: true, name: true } } },
    })

    return NextResponse.json(scheme)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.salesScheme.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 })
    }

    await prisma.salesScheme.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

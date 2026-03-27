import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { createStockAuditDraft } from '@/lib/inventory'

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const status = request.nextUrl.searchParams.get('status')

    const audits = await prisma.stockAudit.findMany({
      where: {
        shopId: shop.id,
        ...(status ? { status } : {}),
      },
      include: {
        godown: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(audits)
  } catch (error) {
    console.error('Stock audits GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { godownId, notes } = await request.json()
    if (!godownId) {
      return NextResponse.json({ error: 'godownId is required' }, { status: 400 })
    }

    const godown = await prisma.godown.findUnique({ where: { id: godownId } })
    if (!godown || godown.shopId !== shop.id) {
      return NextResponse.json({ error: 'Godown not found' }, { status: 404 })
    }

    const audit = await prisma.$transaction((tx) =>
      createStockAuditDraft(tx, { shopId: shop.id, godownId, notes })
    )

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Stock audits POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

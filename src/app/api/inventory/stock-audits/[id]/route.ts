import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = await context.params
    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        godown: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, stock: true, saltComposition: true } },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    })

    if (!audit || audit.shopId !== shop.id) {
      return NextResponse.json({ error: 'Stock audit not found' }, { status: 404 })
    }

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Stock audit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { id } = await context.params
    const { notes, items } = await request.json()

    const audit = await prisma.stockAudit.findUnique({ where: { id } })
    if (!audit || audit.shopId !== shop.id) {
      return NextResponse.json({ error: 'Stock audit not found' }, { status: 404 })
    }

    if (audit.status === 'posted') {
      return NextResponse.json({ error: 'Posted audits cannot be edited' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockAudit.update({
        where: { id },
        data: { notes: notes ?? audit.notes },
      })

      if (Array.isArray(items)) {
        for (const item of items) {
          const physicalQty = Math.max(parseInt(String(item.physicalQty ?? 0), 10) || 0, 0)
          const expectedQty = parseInt(String(item.expectedQty ?? 0), 10) || 0
          await tx.stockAuditItem.update({
            where: { id: item.id },
            data: {
              physicalQty,
              differenceQty: physicalQty - expectedQty,
            },
          })
        }
      }
    })

    const refreshed = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        godown: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, stock: true, saltComposition: true } },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    })

    return NextResponse.json(refreshed)
  } catch (error) {
    console.error('Stock audit PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { addDays, startOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const today = startOfDay(new Date())
    const thresholdDate = addDays(today, 60) // Show up to 60 days ahead

    const batches = await prisma.batch.findMany({
      where: {
        shopId: shop.id,
        quantity: { gt: 0 },
        expiryDate: { not: null, lte: thresholdDate }
      },
      include: {
        product: { select: { id: true, name: true, category: true } },
        godown: { select: { name: true } }
      },
      orderBy: { expiryDate: 'asc' }
    })

    const transformed = batches.map(b => {
      const exp = new Date(b.expiryDate!)
      const isExpired = exp < today
      const daysUntil = isExpired ? 0 : Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        productName: b.product.name,
        category: b.product.category,
        quantity: b.quantity,
        godownName: b.godown?.name || 'Main',
        expiryDate: b.expiryDate,
        isExpired,
        daysUntil
      }
    })

    return NextResponse.json(transformed)
  } catch (error: any) {
    console.error('Expiry Report API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

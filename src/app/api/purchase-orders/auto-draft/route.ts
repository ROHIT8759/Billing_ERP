import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { ensureDraftPurchaseOrdersForLowStock } from '@/lib/inventory'

export async function POST() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const created = await prisma.$transaction((tx) => ensureDraftPurchaseOrdersForLowStock(tx, shop.id))
    return NextResponse.json({ createdCount: created.length, orders: created })
  } catch (error) {
    console.error('Auto draft purchase order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

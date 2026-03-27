import { NextResponse } from 'next/server'
import { getApiUserAndShop } from '@/lib/api-auth'
import { getLowStockProducts } from '@/lib/inventory'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const products = await getLowStockProducts(shop.id)
    return NextResponse.json(products)
  } catch (error) {
    console.error('Low stock API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

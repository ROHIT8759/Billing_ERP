import { NextRequest, NextResponse } from 'next/server'
import { getApiUserAndShop } from '@/lib/api-auth'
import { findProductSubstitutes } from '@/lib/inventory'

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const productId = request.nextUrl.searchParams.get('productId')
    const saltComposition = request.nextUrl.searchParams.get('saltComposition')

    if (!productId && !saltComposition) {
      return NextResponse.json(
        { error: 'productId or saltComposition is required' },
        { status: 400 }
      )
    }

    const substitutes = await findProductSubstitutes(shop.id, { productId, saltComposition })
    return NextResponse.json(substitutes)
  } catch (error) {
    console.error('Substitutes API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

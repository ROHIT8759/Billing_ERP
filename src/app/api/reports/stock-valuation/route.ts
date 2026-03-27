import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const products = await prisma.product.findMany({
      where: { shopId: shop.id, stock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        category: true,
        price: true, // Selling Price
        stock: true,
      },
      orderBy: { name: 'asc' }
    })

    // Fetch all purchase items to calculate the weighted average cost
    const purchases = await prisma.purchaseItem.findMany({
      where: {
        purchase: { shopId: shop.id }
      },
      select: {
        productName: true,
        quantity: true,
        price: true, // This is the Purchase Price (Cost)
      }
    })

    // Calculate Average Cost per product name
    const costMap: Record<string, { totalQty: number, totalCost: number }> = {}
    
    for (const p of purchases) {
      const name = p.productName.toLowerCase().trim()
      if (!costMap[name]) costMap[name] = { totalQty: 0, totalCost: 0 }
      costMap[name].totalQty += p.quantity
      costMap[name].totalCost += p.price * p.quantity
    }

    const valuationResult = products.map((prod: any) => {
      const nameKey = prod.name.toLowerCase().trim()
      const costData = costMap[nameKey]
      
      const avgCost = costData && costData.totalQty > 0 
        ? costData.totalCost / costData.totalQty 
        : 0 // If no purchase history, cost is 0

      return {
        ...prod,
        avgCost,
        totalCostValue: avgCost * prod.stock,
        totalRetailValue: prod.price * prod.stock,
      }
    })

    return NextResponse.json(valuationResult)
  } catch (error: any) {
    console.error('Stock Valuation API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

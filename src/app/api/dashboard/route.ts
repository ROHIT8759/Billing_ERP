import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findUnique({
      where: { userId: user.id }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Get current month's start and end dates
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Aggregations
    const [
      totalSalesData,
      totalPurchasesData,
      recentInvoices,
      productsCount,
      customersCount
    ] = await Promise.all([
      // 1. Total Sales (from invoices)
      prisma.invoice.aggregate({
        where: { shopId: shop.id },
        _sum: { totalAmount: true }
      }),
      // 2. Total Purchases
      prisma.purchase.aggregate({
        where: { shopId: shop.id },
        _sum: { totalAmount: true }
      }),
      // 3. Recent 5 Invoices
      prisma.invoice.findMany({
        where: { shopId: shop.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } }
      }),
      // 4. Total Products
      prisma.product.count({ where: { shopId: shop.id } }),
      // 5. Total Customers
      prisma.customer.count({ where: { shopId: shop.id } })
    ])

    // Get monthly chart data (last 6 months)
    const chartData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      
      const [salesMonth, purchasesMonth] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            shopId: shop.id,
            createdAt: { gte: d, lt: nextMonth }
          },
          _sum: { totalAmount: true }
        }),
        prisma.purchase.aggregate({
          where: {
            shopId: shop.id,
            createdAt: { gte: d, lt: nextMonth }
          },
          _sum: { totalAmount: true }
        })
      ])

      chartData.push({
        name: d.toLocaleString('default', { month: 'short' }),
        sales: salesMonth._sum.totalAmount || 0,
        purchases: purchasesMonth._sum.totalAmount || 0,
      })
    }

    const totalSales = totalSalesData._sum.totalAmount || 0
    const totalPurchases = totalPurchasesData._sum.totalAmount || 0
    const revenue = totalSales - totalPurchases

    return NextResponse.json({
      summary: {
        totalSales,
        totalPurchases,
        revenue,
        productsCount,
        customersCount
      },
      chartData,
      recentInvoices
    })
  } catch (error: any) {
    console.error('Dashboard stats fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

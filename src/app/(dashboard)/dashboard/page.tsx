import { StatCard, Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TrendingUp, IndianRupee, ShoppingCart, Package, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
  if (!shop) redirect('/onboarding')

  const now = new Date()

  // Run all aggregations in parallel
  const [
    totalSalesData,
    totalPurchasesData,
    recentInvoices,
    productsCount,
    customersCount,
  ] = await Promise.all([
    prisma.invoice.aggregate({ where: { shopId: shop.id }, _sum: { totalAmount: true } }),
    prisma.purchase.aggregate({ where: { shopId: shop.id }, _sum: { totalAmount: true } }),
    prisma.invoice.findMany({
      where: { shopId: shop.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    }),
    prisma.product.count({ where: { shopId: shop.id } }),
    prisma.customer.count({ where: { shopId: shop.id } }),
  ])

  // Monthly chart data (last 6 months)
  const chartData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const [s, p] = await Promise.all([
      prisma.invoice.aggregate({ where: { shopId: shop.id, createdAt: { gte: d, lt: nextMonth } }, _sum: { totalAmount: true } }),
      prisma.purchase.aggregate({ where: { shopId: shop.id, createdAt: { gte: d, lt: nextMonth } }, _sum: { totalAmount: true } }),
    ])
    chartData.push({
      name: d.toLocaleString('default', { month: 'short' }),
      sales: s._sum.totalAmount || 0,
      purchases: p._sum.totalAmount || 0,
    })
  }

  const totalSales = totalSalesData._sum.totalAmount || 0
  const totalPurchases = totalPurchasesData._sum.totalAmount || 0
  const revenue = totalSales - totalPurchases

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 text-sm">Welcome back, here&apos;s your business at a glance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue (Profit)"
          value={formatCurrency(revenue)}
          icon={<TrendingUp size={24} />}
          color="indigo"
          trend="Calculated from Sales - Purchases"
          trendUp={revenue >= 0}
        />
        <StatCard
          title="Total Sales"
          value={formatCurrency(totalSales)}
          icon={<IndianRupee size={24} />}
          color="emerald"
        />
        <StatCard
          title="Total Purchases"
          value={formatCurrency(totalPurchases)}
          icon={<ShoppingCart size={24} />}
          color="amber"
        />
        <div className="space-y-6">
          <StatCard
            title="Products in Catalog"
            value={productsCount}
            icon={<Package size={24} />}
            color="violet"
          />
          <StatCard
            title="Total Customers"
            value={customersCount}
            icon={<Users size={24} />}
            color="indigo"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart data={chartData} />
        </div>

        <div>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Recent Sales</h3>
              <Badge variant="info">{recentInvoices.length} invoices</Badge>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
                <ShoppingCart className="w-10 h-10 mb-3 text-slate-300" />
                <p>No sales recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inv.customer.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</p>
                      <Badge variant="success">Paid</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}


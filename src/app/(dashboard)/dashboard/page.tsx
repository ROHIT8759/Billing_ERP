import { StatCard, Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, Users } from 'lucide-react'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  
  const res = await fetch(`${protocol}://${host}/api/dashboard`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl">
        Failed to load dashboard data. Please try again later.
      </div>
    )
  }

  const data = await res.json()
  const { summary, chartData, recentInvoices } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 text-sm">Welcome back, here&apos;s your business at a glance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue (Profit)"
          value={formatCurrency(summary.revenue)}
          icon={<TrendingUp size={24} />}
          color="indigo"
          trend="Calculated from Sales - Purchases"
          trendUp={summary.revenue >= 0}
        />
        <StatCard
          title="Total Sales"
          value={formatCurrency(summary.totalSales)}
          icon={<IndianRupee size={24} />}
          color="emerald"
        />
        <StatCard
          title="Total Purchases"
          value={formatCurrency(summary.totalPurchases)}
          icon={<ShoppingCart size={24} />}
          color="amber"
        />
        <div className="space-y-6">
          <StatCard
            title="Products in Catalog"
            value={summary.productsCount}
            icon={<Package size={24} />}
            color="violet"
          />
          <StatCard
            title="Total Customers"
            value={summary.customersCount}
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

'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

interface RevenueChartProps {
  data: {
    name: string
    sales: number
    purchases: number
  }[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Revenue Overview</h3>
        <p className="text-sm text-slate-500">Sales vs Purchases over the last 6 months</p>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => `₹${value / 1000}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
                      <p className="font-semibold text-slate-900 mb-2">{label}</p>
                      {payload.map((entry, index) => (
                        <div key={index} className="flex flex-col gap-1 mb-1">
                          <span className="text-xs font-medium" style={{ color: entry.color }}>
                            {entry.name === 'sales' ? 'Sales' : 'Purchases'}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(entry.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#4f46e5"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSales)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="purchases"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPurchases)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card, StatCard } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { BookCheck, Landmark, Scale, Wallet } from 'lucide-react'

type TrialBalanceRow = {
  id: string
  code: string
  name: string
  category: string
  debit: number
  credit: number
  balance: number
}

type ReportData = {
  summary: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    receivables: number
    payables: number
    netProfit: number
  }
  trialBalance: TrialBalanceRow[]
  profitLoss: {
    income: number
    expenses: number
    netProfit: number
  }
  balanceSheet: {
    assets: TrialBalanceRow[]
    liabilities: TrialBalanceRow[]
    equity: TrialBalanceRow[]
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
  }
}

function ReportTable({
  title,
  rows,
}: {
  title: string
  rows: TrialBalanceRow[]
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-4 font-medium">Code</th>
              <th className="px-6 py-4 font-medium">Ledger</th>
              <th className="px-6 py-4 font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60">
                <td className="px-6 py-4 text-slate-600">{row.code}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                <td className="px-6 py-4 text-right font-medium text-slate-900">
                  {formatCurrency(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function AccountingReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/accounting/reports')
      .then(async (res) => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load reports')
        setData(payload)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading reports...</div>
  }

  if (error || !data) {
    return <div className="p-10 text-center text-red-500">{error || 'Unable to load reports'}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
        <p className="text-sm text-slate-500">
          Trial balance, P&amp;L, and balance sheet generated from posted ledger entries.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Assets"
          value={formatCurrency(data.summary.totalAssets)}
          icon={<Wallet size={22} />}
          color="indigo"
        />
        <StatCard
          title="Total Liabilities"
          value={formatCurrency(data.summary.totalLiabilities)}
          icon={<Scale size={22} />}
          color="amber"
        />
        <StatCard
          title="Equity + Profit"
          value={formatCurrency(data.summary.totalEquity)}
          icon={<Landmark size={22} />}
          color="violet"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(data.summary.netProfit)}
          icon={<BookCheck size={22} />}
          color="emerald"
          trend={data.summary.netProfit >= 0 ? 'Healthy P&L' : 'Loss position'}
          trendUp={data.summary.netProfit >= 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Profit & Loss</h2>
            <Badge variant={data.profitLoss.netProfit >= 0 ? 'success' : 'danger'}>
              {data.profitLoss.netProfit >= 0 ? 'Profit' : 'Loss'}
            </Badge>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-600">Operating Income</span>
              <span className="font-semibold text-slate-900">{formatCurrency(data.profitLoss.income)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-600">Operating Expenses</span>
              <span className="font-semibold text-slate-900">{formatCurrency(data.profitLoss.expenses)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
              <span className="font-medium text-emerald-800">Net Profit</span>
              <span className="text-lg font-bold text-emerald-800">
                {formatCurrency(data.profitLoss.netProfit)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Trial Balance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Ledger</th>
                  <th className="px-6 py-4 font-medium text-right">Debit</th>
                  <th className="px-6 py-4 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.trialBalance.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-slate-600">{row.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                    <td className="px-6 py-4 text-right text-slate-900">{formatCurrency(row.debit)}</td>
                    <td className="px-6 py-4 text-right text-slate-900">{formatCurrency(row.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ReportTable title="Assets" rows={data.balanceSheet.assets} />
        <ReportTable title="Liabilities" rows={data.balanceSheet.liabilities} />
        <ReportTable title="Equity" rows={data.balanceSheet.equity} />
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowRight,
  BookOpen,
  FileText,
  Landmark,
  Receipt,
  Wallet,
} from 'lucide-react'

type ReportSummary = {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  receivables: number
  payables: number
  netProfit: number
}

type JournalEntry = {
  id: string
  entryNo: string
  voucherType: string
  entryDate: string
  narration: string | null
  lines: { id: string; account: { name: string }; debit: number; credit: number }[]
}

const shortcuts = [
  {
    href: '/accounting/ledgers',
    title: 'Ledgers & COA',
    description: 'Manage debtors, creditors, cash, bank, and custom expense heads.',
    icon: BookOpen,
  },
  {
    href: '/accounting/transactions',
    title: 'Receipts, Payments & Notes',
    description: 'Post receipts, supplier payments, credit notes, and debit notes.',
    icon: Receipt,
  },
  {
    href: '/accounting/reports',
    title: 'Financial Reports',
    description: 'Review trial balance, P&L, and the balance sheet from posted entries.',
    icon: FileText,
  },
] as const

export default function AccountingPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/accounting/reports').then((res) => res.json()),
      fetch('/api/accounting/transactions').then((res) => res.json()),
    ])
      .then(([reportData, transactionData]) => {
        if (reportData.error) throw new Error(reportData.error)
        if (transactionData.error) throw new Error(transactionData.error)
        setSummary(reportData.summary)
        setEntries(transactionData.slice(0, 6))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading accounting workspace...</div>
  }

  if (error || !summary) {
    return <div className="p-10 text-center text-red-500">{error || 'Unable to load accounting data'}</div>
  }

  const cashPosition = summary.totalAssets - summary.receivables

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounting & Finance</h1>
          <p className="text-sm text-slate-500">
            Double-entry accounting for receipts, payments, notes, and statutory reports.
          </p>
        </div>
        <Link href="/accounting/transactions">
          <Button>
            <Receipt size={18} />
            Post Voucher
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Net Profit"
          value={formatCurrency(summary.netProfit)}
          icon={<Landmark size={22} />}
          color="emerald"
          trend={summary.netProfit >= 0 ? 'Profitable position' : 'Loss position'}
          trendUp={summary.netProfit >= 0}
        />
        <StatCard
          title="Receivables"
          value={formatCurrency(summary.receivables)}
          icon={<Wallet size={22} />}
          color="indigo"
        />
        <StatCard
          title="Payables"
          value={formatCurrency(summary.payables)}
          icon={<Receipt size={22} />}
          color="amber"
        />
        <StatCard
          title="Liquid Assets"
          value={formatCurrency(cashPosition)}
          icon={<BookOpen size={22} />}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {shortcuts.map(({ href, title, description, icon: Icon }) => (
          <Card key={href} className="p-6">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Icon size={22} />
              </div>
              <ArrowRight size={18} className="text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <Link href={href} className="mt-5 inline-flex">
              <Button variant="outline">Open</Button>
            </Link>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Accounting Entries</h2>
            <p className="text-sm text-slate-500">Latest vouchers posted into the general ledger.</p>
          </div>
          <Link href="/accounting/reports">
            <Button variant="ghost">View Reports</Button>
          </Link>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No accounting entries yet. Sales, purchases, and manual vouchers will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-slate-900">{entry.entryNo}</p>
                    <Badge variant="info">{entry.voucherType.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {entry.narration || 'No narration'} • {formatDate(entry.entryDate)}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  {entry.lines.slice(0, 2).map((line) => (
                    <p key={line.id}>
                      {line.account.name}: {formatCurrency(line.debit || line.credit)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, RotateCcw } from 'lucide-react'
import Link from 'next/link'

type SalesReturn = {
  id: string
  noteNo: string
  totalAmount: number
  reason: string | null
  createdAt: string
  customer: { name: string }
  invoice: { invoiceNo: string }
}

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchReturns()
  }, [])

  const fetchReturns = async () => {
    try {
      const res = await fetch('/api/sales-returns')
      if (!res.ok) throw new Error('Failed to fetch sales returns')
      const data = await res.json()
      setReturns(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredReturns = returns.filter(r => 
    r.noteNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.invoice.invoiceNo && r.invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={24} className="text-indigo-600" /> Sales Returns (Credit Notes)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer returns and issued credit notes</p>
        </div>
        <Link href="/sales-returns/new">
          <Button className="w-full sm:w-auto flex items-center gap-2">
            <Plus size={16} /> New Credit Note
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Note No, Customer, or Invoice No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>
        ) : loading ? (
          <div className="py-12 text-center text-slate-500 animate-pulse">Loading returns...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Note No</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Against Invoice</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Credit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{r.noteNo}</td>
                    <td className="px-6 py-4 text-slate-700">{r.customer.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-indigo-600">
                      {r.invoice.invoiceNo || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(r.createdAt)}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">
                      {r.reason || <span className="text-slate-300 italic">None</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">
                      {formatCurrency(r.totalAmount)}
                    </td>
                  </tr>
                ))}
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <RotateCcw size={48} className="mx-auto text-slate-200 mb-4" />
                      <p>No credit notes found matching your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

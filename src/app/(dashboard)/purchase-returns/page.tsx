'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, ArchiveRestore } from 'lucide-react'
import Link from 'next/link'

type PurchaseReturn = {
  id: string
  noteNo: string
  totalAmount: number
  reason: string | null
  createdAt: string
  supplier: { name: string }
  purchase: { billNo: string | null, id: string }
}

export default function PurchaseReturnsPage() {
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchReturns()
  }, [])

  const fetchReturns = async () => {
    try {
      const res = await fetch('/api/purchase-returns')
      if (!res.ok) throw new Error('Failed to fetch purchase returns')
      setReturns(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredReturns = returns.filter(r => 
    r.noteNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.purchase.billNo && r.purchase.billNo.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArchiveRestore size={24} className="text-amber-600" /> Purchase Returns (Debit Notes)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage returns to suppliers and issued debit notes</p>
        </div>
        <Link href="/purchase-returns/new">
          <Button className="w-full sm:w-auto flex items-center gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus size={16} /> New Debit Note
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by Note No, Supplier, or Bill No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Against Bill</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Debit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{r.noteNo}</td>
                    <td className="px-6 py-4 text-slate-700">{r.supplier.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-amber-600">
                      {r.purchase.billNo || r.purchase.id.split('-')[0]}
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
                      <ArchiveRestore size={48} className="mx-auto text-slate-200 mb-4" />
                      <p>No debit notes found matching your search.</p>
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

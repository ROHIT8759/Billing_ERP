'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, Clock } from 'lucide-react'

type ExpiryItem = {
  id: string
  batchNumber: string
  productName: string
  category: string | null
  quantity: number
  godownName: string
  expiryDate: string
  isExpired: boolean
  daysUntil: number
}

export default function ExpiryReportPage() {
  const [data, setData] = useState<ExpiryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/reports/expiry')
      if (!res.ok) throw new Error('Failed to load expiry report')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const expired = data.filter(d => d.isExpired)
  const expiringSoon = data.filter(d => !d.isExpired)

  const renderTable = (items: ExpiryItem[], emptyMsg: string) => {
    if (items.length === 0) {
      return <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">{emptyMsg}</div>
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3 text-right">Qty Left</th>
              <th className="px-5 py-3 text-center">Batch #</th>
              <th className="px-5 py-3 text-center">Godown</th>
              <th className="px-5 py-3 text-right">Expiry Date</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900">{item.productName}</div>
                  {item.category && <div className="text-xs text-slate-500 mt-0.5">{item.category}</div>}
                </td>
                <td className="px-5 py-3 text-right">
                  <Badge variant="default" className="bg-slate-100 text-slate-700">{item.quantity}</Badge>
                </td>
                <td className="px-5 py-3 text-center font-mono text-xs text-slate-500">{item.batchNumber}</td>
                <td className="px-5 py-3 text-center text-slate-600">{item.godownName}</td>
                <td className="px-5 py-3 text-right text-slate-700 font-medium">{formatDate(item.expiryDate)}</td>
                <td className="px-5 py-3 text-right">
                  {item.isExpired ? (
                    <Badge variant="danger" className="text-red-700 bg-red-100 border border-red-200">Expired</Badge>
                  ) : (
                    <Badge variant={item.daysUntil <= 15 ? 'danger' : 'warning'} className={item.daysUntil <= 15 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                      In {item.daysUntil} day{item.daysUntil > 1 ? 's' : ''}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={24} className="text-rose-600" /> Expiry Tracker
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitor expired and near-expiry (60 days) batches</p>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse">Scanning batches...</div>
      ) : (
        <div className="space-y-10">
          
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle size={18} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Expired Stock</h2>
              <Badge variant="danger" className="ml-2 bg-red-100 text-red-700">{expired.length}</Badge>
            </div>
            {renderTable(expired, "No expired stock on hand. Great job!")}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 mt-8">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Clock size={18} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Expiring Soon (Next 60 Days)</h2>
              <Badge variant="warning" className="ml-2 bg-amber-100 text-amber-700">{expiringSoon.length}</Badge>
            </div>
            {renderTable(expiringSoon, "No stock expiring in the next 60 days.")}
          </section>

        </div>
      )}
    </div>
  )
}

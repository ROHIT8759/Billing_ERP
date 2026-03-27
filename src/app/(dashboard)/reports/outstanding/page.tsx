'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Users2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'

type OutstandingItem = {
  id: string
  partyType: 'CUSTOMER' | 'SUPPLIER'
  partyName: string
  partyPhone: string | null
  totalDebit: number
  totalCredit: number
  netBalance: number
}

export default function OutstandingReportPage() {
  const [data, setData] = useState<OutstandingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/reports/outstanding')
      if (!res.ok) throw new Error('Failed to load outstanding report')
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

  const receivables = useMemo(() => {
    return data.filter(d => (d.partyType === 'CUSTOMER' && d.netBalance > 0) || (d.partyType === 'SUPPLIER' && d.netBalance < 0))
  }, [data])

  const payables = useMemo(() => {
    return data.filter(d => (d.partyType === 'SUPPLIER' && d.netBalance > 0) || (d.partyType === 'CUSTOMER' && d.netBalance < 0))
  }, [data])

  const totalReceivables = receivables.reduce((sum, item) => sum + Math.abs(item.netBalance), 0)
  const totalPayables = payables.reduce((sum, item) => sum + Math.abs(item.netBalance), 0)

  const currentData = activeTab === 'RECEIVABLES' ? receivables : payables

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users2 size={24} className="text-indigo-600" /> Party Outstanding
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track receivables (who owes you) and payables (who you owe)</p>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse">Calculating balances...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div 
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer transition-all ${activeTab === 'RECEIVABLES' ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : 'hover:bg-slate-50'}`}
              onClick={() => setActiveTab('RECEIVABLES')}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 md:text-emerald-700 uppercase tracking-wilder mb-1 flex items-center gap-1">
                    <ArrowDownLeft size={14} /> Total Receivables
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalReceivables)}</p>
                </div>
                <Badge variant={activeTab === 'RECEIVABLES' ? 'success' : 'default'} className={activeTab === 'RECEIVABLES' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                  {receivables.length} parties
                </Badge>
              </div>
            </div>

            <div 
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer transition-all ${activeTab === 'PAYABLES' ? 'ring-2 ring-rose-500 bg-rose-50/30' : 'hover:bg-slate-50'}`}
              onClick={() => setActiveTab('PAYABLES')}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-rose-600 md:text-rose-700 uppercase tracking-wilder mb-1 flex items-center gap-1">
                    <ArrowUpRight size={14} /> Total Payables
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalPayables)}</p>
                </div>
                <Badge variant={activeTab === 'PAYABLES' ? 'danger' : 'default'} className={activeTab === 'PAYABLES' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}>
                  {payables.length} parties
                </Badge>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {activeTab === 'RECEIVABLES' ? 'Parties who owe you money' : 'Parties you owe money to'}
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] whitespace-nowrap">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold cursor-pointer select-none">
                  <tr>
                    <th className="px-3 py-2 border-r border-slate-200">Party Name</th>
                    <th className="px-3 py-2 border-r border-slate-200">Contact</th>
                    <th className="px-3 py-2 text-center border-r border-slate-200">Type</th>
                    <th className="px-3 py-2 text-right">Pending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {currentData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-900 border-r border-slate-100">{row.partyName}</td>
                      <td className="px-3 py-2 text-slate-500 border-r border-slate-100">{row.partyPhone || <span className="text-slate-300">N/A</span>}</td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">
                        <Badge variant="default" className="bg-slate-100 text-slate-600">
                          {row.partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                        </Badge>
                        {(row.partyType === 'CUSTOMER' && activeTab === 'PAYABLES') && (
                          <div className="text-[10px] text-slate-400 mt-1">Advance received</div>
                        )}
                        {(row.partyType === 'SUPPLIER' && activeTab === 'RECEIVABLES') && (
                          <div className="text-[10px] text-slate-400 mt-1">Advance paid</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        {formatCurrency(Math.abs(row.netBalance))}
                      </td>
                    </tr>
                  ))}
                  {currentData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        No pending {activeTab.toLowerCase()} found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ArrowDown, ArrowUp } from 'lucide-react'

type StockValuation = {
  id: string
  name: string
  category: string | null
  stock: number
  price: number // Retail/Selling Price
  avgCost: number // Purchase Avg Cost
  totalCostValue: number
  totalRetailValue: number
}

export default function StockValuationPage() {
  const [data, setData] = useState<StockValuation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortObj, setSortObj] = useState<{ field: keyof StockValuation, dir: 'asc' | 'desc' }>({ field: 'totalCostValue', dir: 'desc' })

  const fetchData = async () => {
    try {
      const res = await fetch('/api/reports/stock-valuation')
      if (!res.ok) throw new Error('Failed to load stock valuation')
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

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortObj.field]
      const bVal = b[sortObj.field]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortObj.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const numA = (aVal as number) || 0
      const numB = (bVal as number) || 0
      return sortObj.dir === 'asc' ? numA - numB : numB - numA
    })
  }, [data, sortObj])

  const handleSort = (field: keyof StockValuation) => {
    setSortObj(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }))
  }

  const totals = data.reduce((acc, row) => ({
    stock: acc.stock + row.stock,
    cost: acc.cost + row.totalCostValue,
    retail: acc.retail + row.totalRetailValue
  }), { stock: 0, cost: 0, retail: 0 })

  const SortIcon = ({ field }: { field: keyof StockValuation }) => {
    if (sortObj.field !== field) return <span className="w-4" />
    return sortObj.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator size={24} className="text-indigo-600" /> Stock Valuation
          </h1>
          <p className="text-slate-500 text-sm mt-1">Inventory value by Average Purchase Cost</p>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse">Calculating valuation...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 bg-indigo-50/50 border-indigo-100">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wilder mb-1">Total Stock Quantities</p>
              <p className="text-2xl font-bold text-slate-900">{totals.stock}</p>
            </Card>
            <Card className="p-5 bg-amber-50/50 border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wilder mb-1">Total Value (At Cost)</p>
              <p className="text-2xl font-bold text-amber-900">{formatCurrency(totals.cost)}</p>
            </Card>
            <Card className="p-5 bg-emerald-50/50 border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wilder mb-1">Total Value (At Retail)</p>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totals.retail)}</p>
              <p className="text-xs text-emerald-600 mt-1 font-medium">Potential Margin: {totals.retail > 0 ? (((totals.retail - totals.cost) / totals.retail) * 100).toFixed(1) : 0}%</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold cursor-pointer select-none">
                  <tr>
                    <th className="px-5 py-4 hover:bg-slate-200" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Product <SortIcon field="name" /></div>
                    </th>
                    <th className="px-5 py-4 hover:bg-slate-200 text-right" onClick={() => handleSort('stock')}>
                      <div className="flex items-center justify-end gap-1">On Hand <SortIcon field="stock" /></div>
                    </th>
                    <th className="px-5 py-4 hover:bg-slate-200 text-right" onClick={() => handleSort('avgCost')}>
                      <div className="flex items-center justify-end gap-1">Avg Unit Cost <SortIcon field="avgCost" /></div>
                    </th>
                    <th className="px-5 py-4 hover:bg-slate-200 text-right" onClick={() => handleSort('price')}>
                      <div className="flex items-center justify-end gap-1">Selling Price <SortIcon field="price" /></div>
                    </th>
                    <th className="px-5 py-4 hover:bg-slate-200 text-right bg-amber-50/50" onClick={() => handleSort('totalCostValue')}>
                      <div className="flex items-center justify-end gap-1 text-amber-800">Total Cost <SortIcon field="totalCostValue" /></div>
                    </th>
                    <th className="px-5 py-4 hover:bg-slate-200 text-right bg-emerald-50/50" onClick={() => handleSort('totalRetailValue')}>
                      <div className="flex items-center justify-end gap-1 text-emerald-800">Total Retail <SortIcon field="totalRetailValue" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        {row.category && <div className="text-xs text-slate-500 mt-0.5">{row.category}</div>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant="default" className="bg-slate-100 text-slate-700">{row.stock}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(row.avgCost)}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(row.price)}</td>
                      <td className="px-5 py-3 text-right font-medium text-amber-800 bg-amber-50/10 border-l border-amber-50">
                        {formatCurrency(row.totalCostValue)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-emerald-800 bg-emerald-50/10 border-l border-emerald-50">
                        {formatCurrency(row.totalRetailValue)}
                      </td>
                    </tr>
                  ))}
                  {sortedData.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">No active stock in inventory.</td></tr>
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

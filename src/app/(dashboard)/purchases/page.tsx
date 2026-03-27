'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Trash2, Truck, ScanLine } from 'lucide-react'
import Link from 'next/link'

type Purchase = {
  id: string
  vendorName: string
  totalAmount: number
  createdAt: string
  items: any[]
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases')
      if (!res.ok) throw new Error('Failed to fetch purchases')
      const data = await res.json()
      setPurchases(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase? Stock amounts will be adjusted.')) return
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete purchase')
      await fetchPurchases()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredPurchases = purchases.filter(p => 
    p.vendorName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
          <p className="text-slate-500 text-sm">Manage vendor bills and stock inwards</p>
        </div>
        <div className="flex gap-3">
          <Link href="/purchases/scan" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto text-amber-600 border-amber-200 hover:bg-amber-50">
              <ScanLine size={18} />
              Scan Invoice
            </Button>
          </Link>
          <Link href="/purchases/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus size={18} />
              Manual Entry
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by vendor name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading purchases...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500">
              <Truck size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No purchases found</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              {search ? 'Try adjusting your search query.' : 'Record your first vendor purchase to manage inventory inwards.'}
            </p>
            {!search && (
              <div className="flex gap-3 mt-6">
                <Link href="/purchases/scan">
                  <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                    <ScanLine size={18} /> Scan Invoice
                  </Button>
                </Link>
                <Link href="/purchases/new">
                  <Button>Manual Entry</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Vendor</th>
                  <th className="px-6 py-4 font-medium">Items Count</th>
                  <th className="px-6 py-4 font-medium text-right">Total Amount</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">{formatDate(purchase.createdAt)}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{purchase.vendorName}</td>
                    <td className="px-6 py-4 text-slate-500">{purchase.items.length} items</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      {formatCurrency(purchase.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

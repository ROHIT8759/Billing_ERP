'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Trash2, Truck, Building2, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

type Purchase = {
  id: string
  vendorName: string
  billNo: string | null
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  createdAt: string
  items: Array<{ id: string }>
  supplier: { id: string; name: string } | null
}

function paymentBadge(s: string): { variant: 'success' | 'warning' | 'danger' | 'default'; label: string } {
  switch (s) {
    case 'PAID':    return { variant: 'success', label: 'Paid' }
    case 'PARTIAL': return { variant: 'warning', label: 'Partial' }
    case 'OVERDUE': return { variant: 'danger',  label: 'Overdue' }
    default:        return { variant: 'danger',  label: 'Unpaid' }
  }
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [payingPurchase, setPayingPurchase] = useState<Purchase | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMode: 'CASH', entryDate: '', narration: '' })
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

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

  const openPayment = (p: Purchase) => {
    setPayingPurchase(p)
    setPaymentForm({
      amount: p.outstandingAmount.toFixed(2),
      paymentMode: 'CASH',
      entryDate: new Date().toISOString().slice(0, 10),
      narration: ''
    })
    setPaymentError('')
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingPurchase) return
    setPaymentLoading(true)
    setPaymentError('')
    try {
      const res = await fetch(`/api/purchases/${payingPurchase.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          paymentMode: paymentForm.paymentMode,
          entryDate: paymentForm.entryDate || undefined,
          narration: paymentForm.narration || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      setPayingPurchase(null)
      await fetchPurchases()
    } catch (err: any) {
      setPaymentError(err.message)
    } finally {
      setPaymentLoading(false)
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
          <Link href="/suppliers" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <Building2 size={18} />
              Suppliers
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
                <Link href="/purchases/new">
                  <Button>Manual Entry</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold border-r border-slate-200">Date</th>
                  <th className="px-3 py-2 font-semibold border-r border-slate-200">Vendor</th>
                  <th className="px-3 py-2 font-semibold border-r border-slate-200">Items</th>
                  <th className="px-3 py-2 font-semibold text-right border-r border-slate-200">Total</th>
                  <th className="px-3 py-2 font-semibold text-right border-r border-slate-200">Outstanding</th>
                  <th className="px-3 py-2 font-semibold text-center border-r border-slate-200">Payment</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-50">{formatDate(purchase.createdAt)}</td>
                    <td className="px-3 py-2 border-r border-slate-50">
                      <div className="font-semibold text-slate-900">{purchase.vendorName}</div>
                      {purchase.billNo && <div className="text-[10px] text-slate-500 font-mono">{purchase.billNo}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-50">{purchase.items.length}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 border-r border-slate-50">
                      {formatCurrency(purchase.totalAmount)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-slate-50">
                      {purchase.outstandingAmount > 0 ? (
                        <span className="font-semibold text-red-600">{formatCurrency(purchase.outstandingAmount)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-50">
                      {(() => { const b = paymentBadge(purchase.paymentStatus); return <Badge variant={b.variant}>{b.label}</Badge> })()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {purchase.paymentStatus !== 'PAID' && (
                          <button
                            onClick={() => openPayment(purchase)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Record Payment"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
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

      {/* Record Payment Modal */}
      <Modal isOpen={!!payingPurchase} onClose={() => !paymentLoading && setPayingPurchase(null)} title="Record Payment">
        {payingPurchase && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Vendor</span>
                <span className="font-medium text-slate-900">{payingPurchase.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding</span>
                <span className="font-bold text-red-600">{formatCurrency(payingPurchase.outstandingAmount)}</span>
              </div>
            </div>

            <Input
              label="Amount *"
              type="number"
              step="0.01"
              min="0.01"
              max={payingPurchase.outstandingAmount}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={paymentForm.entryDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, entryDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                />
              </div>
            </div>

            <Input
              label="Notes"
              value={paymentForm.narration}
              onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
              placeholder="Optional reference / narration"
            />

            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setPayingPurchase(null)} disabled={paymentLoading}>Cancel</Button>
              <Button type="submit" loading={paymentLoading}>Record Payment</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

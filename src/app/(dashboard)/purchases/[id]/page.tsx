'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, CreditCard, Truck, Package } from 'lucide-react'
import Link from 'next/link'

function paymentBadge(s: string): { variant: 'success' | 'warning' | 'danger' | 'default'; label: string } {
  switch (s) {
    case 'PAID':    return { variant: 'success', label: 'Paid' }
    case 'PARTIAL': return { variant: 'warning', label: 'Partial' }
    case 'OVERDUE': return { variant: 'danger',  label: 'Overdue' }
    default:        return { variant: 'danger',  label: 'Unpaid' }
  }
}

type PurchaseItem = {
  id: string
  productName: string
  batchNo: string | null
  pack: string | null
  quantity: number
  freeQty: number
  price: number
  discountPct: number
  amount: number
}

type Purchase = {
  id: string
  vendorName: string
  billNo: string | null
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  dueDate: string | null
  createdAt: string
  imageUrl: string | null
  supplier: { id: string; name: string } | null
  items: PurchaseItem[]
}

type Allocation = {
  id: string
  amount: number
  allocatedAt: string
  journalEntry: {
    entryNo: string
    voucherType: string
    entryDate: string
    reference: string | null
  }
}

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)

  const [purchase, setPurchase]     = useState<Purchase | null>(null)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [isPaymentOpen, setIsPaymentOpen]   = useState(false)
  const [paymentForm, setPaymentForm]       = useState({ amount: '', paymentMode: 'CASH', entryDate: '', narration: '' })
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError]     = useState('')

  const fetchPurchase = useCallback(async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/purchases/${id}`),
        fetch(`/api/purchases/${id}/payments`),
      ])
      if (!pRes.ok) throw new Error('Failed to load purchase')
      setPurchase(await pRes.json())
      if (aRes.ok) setAllocations(await aRes.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchPurchase() }, [fetchPurchase])

  const openPayment = () => {
    if (!purchase) return
    setPaymentForm({
      amount: purchase.outstandingAmount.toFixed(2),
      paymentMode: 'CASH',
      entryDate: new Date().toISOString().slice(0, 10),
      narration: '',
    })
    setPaymentError('')
    setIsPaymentOpen(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchase) return
    setPaymentLoading(true)
    setPaymentError('')
    try {
      const res = await fetch(`/api/purchases/${purchase.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:      parseFloat(paymentForm.amount),
          paymentMode: paymentForm.paymentMode,
          entryDate:   paymentForm.entryDate || undefined,
          narration:   paymentForm.narration || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      setIsPaymentOpen(false)
      await fetchPurchase()
    } catch (err: any) {
      setPaymentError(err.message)
    } finally {
      setPaymentLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  if (error || !purchase) return (
    <div className="p-10 text-center text-red-500">{error || 'Purchase not found'}</div>
  )

  const badge = paymentBadge(purchase.paymentStatus)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/purchases">
          <Button variant="ghost" className="p-2"><ArrowLeft size={20} /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck size={22} className="text-amber-600" />
            {purchase.vendorName}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {purchase.billNo ? `Bill No: ${purchase.billNo} · ` : ''}
            Created {formatDate(purchase.createdAt)}
          </p>
        </div>
        {purchase.paymentStatus !== 'PAID' && (
          <Button onClick={openPayment}>
            <CreditCard size={16} className="mr-2" /> Record Payment
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Amount</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(purchase.totalAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(purchase.paidAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${purchase.outstandingAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {formatCurrency(purchase.outstandingAmount)}
          </p>
        </Card>
        <Card className="p-4 flex flex-col justify-between">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
          <Badge variant={badge.variant} className="mt-2 text-sm px-3 py-1 w-fit">{badge.label}</Badge>
          {purchase.dueDate && (
            <p className="text-[11px] text-slate-400 mt-1">Due {formatDate(purchase.dueDate)}</p>
          )}
        </Card>
      </div>

      {/* Items */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Package size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900">Items ({purchase.items.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">Batch</th>
                <th className="px-3 py-2 text-left font-semibold">Pack</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Free</th>
                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                <th className="px-3 py-2 text-right font-semibold">Disc%</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchase.items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{item.productName}</td>
                  <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{item.batchNo || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{item.pack || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">
                    {item.freeQty > 0 ? `+${item.freeQty}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">
                    {item.discountPct > 0 ? `${item.discountPct}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatCurrency(item.amount || item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={7} className="px-4 py-2 text-right font-bold text-slate-700">Total</td>
                <td className="px-4 py-2 text-right font-bold text-indigo-600 text-base">{formatCurrency(purchase.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Payment history */}
      {allocations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <CreditCard size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Payment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Voucher</th>
                  <th className="px-4 py-2 text-left font-semibold">Reference</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(a.journalEntry.entryDate)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="default">{a.journalEntry.voucherType}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{a.journalEntry.reference || a.journalEntry.entryNo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold text-slate-700">Total Paid</td>
                  <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(purchase.paidAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* If OCR scanned — show image */}
      {purchase.imageUrl && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Scanned Invoice</p>
          <img src={purchase.imageUrl} alt="Scanned bill" className="max-w-full rounded-lg border border-slate-200 shadow-sm" />
        </Card>
      )}

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={() => !paymentLoading && setIsPaymentOpen(false)} title="Record Payment">
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Vendor</span>
              <span className="font-medium text-slate-900">{purchase.vendorName}</span>
            </div>
            {purchase.billNo && (
              <div className="flex justify-between">
                <span className="text-slate-500">Bill No</span>
                <span className="font-medium text-slate-900 font-mono">{purchase.billNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding</span>
              <span className="font-bold text-red-600">{formatCurrency(purchase.outstandingAmount)}</span>
            </div>
          </div>

          <Input
            label="Amount *"
            type="number"
            step="0.01"
            min="0.01"
            max={purchase.outstandingAmount}
            value={paymentForm.amount}
            onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentForm.paymentMode}
                onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
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
                onChange={e => setPaymentForm({ ...paymentForm, entryDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>
          </div>

          <Input
            label="Notes"
            value={paymentForm.narration}
            onChange={e => setPaymentForm({ ...paymentForm, narration: e.target.value })}
            placeholder="Optional reference / narration"
          />

          {paymentError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{paymentError}</p>}

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsPaymentOpen(false)} disabled={paymentLoading}>Cancel</Button>
            <Button type="submit" loading={paymentLoading}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

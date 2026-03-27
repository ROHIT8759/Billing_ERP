'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { Plus, PackageSearch, Edit2, Trash2, AlertTriangle } from 'lucide-react'

type Batch = {
  id: string
  batchNumber: string
  mfgDate: string | null
  expiryDate: string | null
  quantity: number
  createdAt: string
  product: { id: string; name: string; category: string | null }
  godown: { id: string; name: string } | null
}

type Product = { id: string; name: string }
type Godown = { id: string; name: string }

function expiryStatus(expiryDate: string | null): 'expired' | 'critical' | 'warning' | 'ok' | 'none' {
  if (!expiryDate) return 'none'
  const now = new Date()
  const exp = new Date(expiryDate)
  const diffDays = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 7) return 'critical'
  if (diffDays <= 30) return 'warning'
  return 'ok'
}

const statusColors = {
  expired: 'bg-red-50 border-red-200',
  critical: 'bg-orange-50 border-orange-200',
  warning: 'bg-yellow-50 border-yellow-200',
  ok: '',
  none: '',
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProduct, setFilterProduct] = useState('')
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'expired' | 'expiring30' | 'ok'>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({
    productId: '',
    godownId: '',
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    quantity: ''
  })

  const fetchBatches = async () => {
    const res = await fetch('/api/batches')
    if (res.ok) setBatches(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchBatches()
    fetch('/api/products').then((r) => r.json()).then(setProducts)
    fetch('/api/godowns').then((r) => r.json()).then(setGodowns)
  }, [])

  const openModal = (b?: Batch) => {
    if (b) {
      setEditingId(b.id)
      setForm({
        productId: b.product.id,
        godownId: b.godown?.id || '',
        batchNumber: b.batchNumber,
        mfgDate: b.mfgDate ? b.mfgDate.slice(0, 10) : '',
        expiryDate: b.expiryDate ? b.expiryDate.slice(0, 10) : '',
        quantity: b.quantity.toString()
      })
    } else {
      setEditingId(null)
      setForm({ productId: '', godownId: '', batchNumber: '', mfgDate: '', expiryDate: '', quantity: '' })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const url = editingId ? `/api/batches/${editingId}` : '/api/batches'
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: parseInt(form.quantity), godownId: form.godownId || null })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchBatches()
      setIsModalOpen(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this batch?')) return
    const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' })
    if (res.ok) fetchBatches()
  }

  const now = new Date()
  const filtered = batches.filter((b) => {
    if (filterProduct && b.product.id !== filterProduct) return false
    if (filterExpiry === 'expired') return b.expiryDate && new Date(b.expiryDate) < now
    if (filterExpiry === 'expiring30') {
      if (!b.expiryDate) return false
      const days = (new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return days >= 0 && days <= 30
    }
    if (filterExpiry === 'ok') return !b.expiryDate || new Date(b.expiryDate) > now
    return true
  })

  const expiredCount = batches.filter((b) => b.expiryDate && new Date(b.expiryDate) < now).length
  const criticalCount = batches.filter((b) => {
    if (!b.expiryDate) return false
    const d = (new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return d >= 0 && d <= 7
  }).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batch & Expiry Tracking</h1>
          <p className="text-slate-500 text-sm">Track product batches, manufacturing dates, and expiry</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={18} /> Add Batch
        </Button>
      </div>

      {(expiredCount > 0 || criticalCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} />
              {expiredCount} batch{expiredCount > 1 ? 'es' : ''} expired
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm text-orange-700">
              <AlertTriangle size={16} />
              {criticalCount} batch{criticalCount > 1 ? 'es' : ''} expiring within 7 days
            </div>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-3">
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
          >
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-1">
            {(['all', 'expired', 'expiring30', 'ok'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterExpiry(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterExpiry === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {f === 'all' ? 'All' : f === 'expired' ? 'Expired' : f === 'expiring30' ? 'Expiring ≤30d' : 'OK'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading batches...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <PackageSearch size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No batches found</h3>
            <p className="text-slate-500 text-sm">Add batch records to track expiry and stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Batch #</th>
                  <th className="px-6 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Godown</th>
                  <th className="px-6 py-4 font-medium">Mfg Date</th>
                  <th className="px-6 py-4 font-medium">Expiry Date</th>
                  <th className="px-6 py-4 font-medium text-right">Qty</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => {
                  const status = expiryStatus(b.expiryDate)
                  return (
                    <tr key={b.id} className={`hover:bg-slate-50/50 transition-colors ${statusColors[status]}`}>
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">{b.batchNumber}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{b.product.name}</div>
                        {b.product.category && <div className="text-xs text-slate-500">{b.product.category}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{b.godown?.name ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-6 py-4 text-slate-600">{b.mfgDate ? formatDate(b.mfgDate) : <span className="text-slate-400">—</span>}</td>
                      <td className="px-6 py-4">
                        {b.expiryDate ? (
                          <span className={status === 'expired' ? 'text-red-600 font-semibold' : status === 'critical' ? 'text-orange-600 font-semibold' : status === 'warning' ? 'text-yellow-600' : 'text-slate-700'}>
                            {formatDate(b.expiryDate)}
                            {status === 'expired' && ' (Expired)'}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={b.quantity > 10 ? 'success' : b.quantity > 0 ? 'warning' : 'danger'}>
                          {b.quantity}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(b)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => !formLoading && setIsModalOpen(false)} title={editingId ? 'Edit Batch' : 'Add Batch'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
            <select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              required
              disabled={!!editingId}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50"
            >
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Godown</label>
            <select
              value={form.godownId}
              onChange={(e) => setForm({ ...form, godownId: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">No specific godown</option>
              {godowns.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <Input label="Batch Number *" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} placeholder="e.g. BT-2025-001" required />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mfg. Date</label>
              <input
                type="date"
                value={form.mfgDate}
                onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>
          </div>
          <Input label="Quantity *" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button type="submit" loading={formLoading}>{editingId ? 'Save Changes' : 'Add Batch'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

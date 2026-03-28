'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Plus, Tag, Edit2, Trash2, Gift, Percent } from 'lucide-react'

type Product = { id: string; name: string }

type Scheme = {
  id: string
  productId: string
  name: string
  type: string
  minQty: number
  freeQty: number
  discountPct: number
  startDate: string | null
  endDate: string | null
  isActive: boolean
  createdAt: string
  product: { id: string; name: string }
}

const EMPTY_FORM = {
  productId: '',
  name: '',
  type: 'FREE_QTY',
  minQty: '',
  freeQty: '',
  discountPct: '',
  startDate: '',
  endDate: '',
  isActive: true,
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const fetchData = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/schemes'),
        fetch('/api/products'),
      ])
      if (sRes.ok) setSchemes(await sRes.json())
      if (pRes.ok) setProducts(await pRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setIsModalOpen(true)
  }

  const openEdit = (s: Scheme) => {
    setEditingId(s.id)
    setForm({
      productId: s.productId,
      name: s.name,
      type: s.type,
      minQty: String(s.minQty),
      freeQty: String(s.freeQty),
      discountPct: String(s.discountPct),
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '',
      isActive: s.isActive,
    })
    setError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const payload = {
        productId: form.productId,
        name: form.name,
        type: form.type,
        minQty: parseInt(form.minQty, 10),
        freeQty: form.type === 'FREE_QTY' ? parseInt(form.freeQty || '0', 10) : 0,
        discountPct: form.type === 'PERCENTAGE' ? parseFloat(form.discountPct || '0') : 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isActive: form.isActive,
      }
      const url = editingId ? `/api/schemes/${editingId}` : '/api/schemes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save scheme')
      }
      await fetchData()
      setIsModalOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheme?')) return
    const res = await fetch(`/api/schemes/${id}`, { method: 'DELETE' })
    if (res.ok) setSchemes(prev => prev.filter(s => s.id !== id))
  }

  const handleToggleActive = async (scheme: Scheme) => {
    const res = await fetch(`/api/schemes/${scheme.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !scheme.isActive }),
    })
    if (res.ok) await fetchData()
  }

  const isExpired = (s: Scheme) => s.endDate && new Date(s.endDate) < new Date()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Schemes</h1>
          <p className="text-slate-500 text-sm mt-1">Manage Buy-X-Get-Y and percentage discount schemes</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" /> New Scheme
        </Button>
      </div>

      {schemes.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No schemes yet</p>
          <p className="text-sm mt-1">Create Buy X Get Y or discount schemes that auto-apply at POS</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schemes.map(s => (
            <Card key={s.id} className={`p-5 ${!s.isActive || isExpired(s) ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {s.type === 'FREE_QTY'
                    ? <Gift size={18} className="text-green-600 shrink-0" />
                    : <Percent size={18} className="text-blue-600 shrink-0" />
                  }
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.product.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isExpired(s) && <Badge variant="danger">Expired</Badge>}
                  {!isExpired(s) && (
                    <Badge variant={s.isActive ? 'success' : 'default'}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 mb-3 text-sm">
                {s.type === 'FREE_QTY' ? (
                  <p className="text-slate-700">
                    Buy <span className="font-bold text-indigo-600">{s.minQty}</span> → Get{' '}
                    <span className="font-bold text-green-600">{s.freeQty} free</span>
                  </p>
                ) : (
                  <p className="text-slate-700">
                    Buy <span className="font-bold text-indigo-600">{s.minQty}+</span> → Get{' '}
                    <span className="font-bold text-blue-600">{s.discountPct}% off</span>
                  </p>
                )}
                {(s.startDate || s.endDate) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {s.startDate ? s.startDate.slice(0, 10) : '∞'} – {s.endDate ? s.endDate.slice(0, 10) : '∞'}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(s)}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Scheme' : 'New Scheme'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
            <select
              value={form.productId}
              onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              required
              disabled={!!editingId}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
            >
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <Input
            label="Scheme Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            placeholder="e.g. Diwali Offer — Buy 10 Get 1 Free"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="FREE_QTY">Free Quantity (Buy X Get Y Free)</option>
              <option value="PERCENTAGE">Percentage Discount</option>
            </select>
          </div>

          <Input
            label="Minimum Quantity (trigger) *"
            type="number"
            min="1"
            value={form.minQty}
            onChange={e => setForm(f => ({ ...f, minQty: e.target.value }))}
            required
            placeholder="e.g. 10"
          />

          {form.type === 'FREE_QTY' ? (
            <Input
              label="Free Quantity *"
              type="number"
              min="1"
              value={form.freeQty}
              onChange={e => setForm(f => ({ ...f, freeQty: e.target.value }))}
              required
              placeholder="e.g. 1"
            />
          ) : (
            <Input
              label="Discount % *"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={form.discountPct}
              onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))}
              required
              placeholder="e.g. 10"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span className="text-sm text-slate-700">Active (applies at POS)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="flex-1">
              {editingId ? 'Update Scheme' : 'Create Scheme'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

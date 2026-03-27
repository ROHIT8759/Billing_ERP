'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, Warehouse, Edit2, Trash2, ArrowLeftRight, Star } from 'lucide-react'

type GodownStockItem = {
  id: string
  quantity: number
  product: { id: string; name: string; price: number }
}

type Godown = {
  id: string
  name: string
  address: string | null
  isDefault: boolean
  stock: GodownStockItem[]
  _count: { stock: number; batches: number }
}

type Product = { id: string; name: string }

export default function GodownsPage() {
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', isDefault: false })

  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transfer, setTransfer] = useState({ fromGodownId: '', toGodownId: '', productId: '', quantity: '' })
  const [transferLoading, setTransferLoading] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchGodowns = async () => {
    try {
      const res = await fetch('/api/godowns')
      if (res.ok) setGodowns(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    const res = await fetch('/api/products')
    if (res.ok) setProducts(await res.json())
  }

  useEffect(() => { fetchGodowns(); fetchProducts() }, [])

  const openModal = (g?: Godown) => {
    if (g) {
      setEditingId(g.id)
      setForm({ name: g.name, address: g.address || '', isDefault: g.isDefault })
    } else {
      setEditingId(null)
      setForm({ name: '', address: '', isDefault: false })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const url = editingId ? `/api/godowns/${editingId}` : '/api/godowns'
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchGodowns()
      setIsModalOpen(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this godown? Stock records will also be removed.')) return
    const res = await fetch(`/api/godowns/${id}`, { method: 'DELETE' })
    if (res.ok) fetchGodowns()
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferLoading(true)
    try {
      const res = await fetch('/api/godowns/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transfer, quantity: parseInt(transfer.quantity) })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchGodowns()
      setIsTransferOpen(false)
      setTransfer({ fromGodownId: '', toGodownId: '', productId: '', quantity: '' })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setTransferLoading(false)
    }
  }

  const totalStockValue = (g: Godown) =>
    g.stock.reduce((s, item) => s + item.quantity * item.product.price, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Godowns / Warehouses</h1>
          <p className="text-slate-500 text-sm">Manage stock across multiple storage locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsTransferOpen(true)}>
            <ArrowLeftRight size={16} />
            Transfer Stock
          </Button>
          <Button onClick={() => openModal()}>
            <Plus size={18} />
            Add Godown
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500">Loading...</div>
      ) : godowns.length === 0 ? (
        <Card className="p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Warehouse size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No godowns yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first warehouse / godown to track stock by location.</p>
          <Button onClick={() => openModal()}>Add Godown</Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {godowns.map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                      <Warehouse size={18} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-slate-900 truncate">{g.name}</h3>
                        {g.isDefault && <Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />}
                      </div>
                      {g.address && <p className="text-xs text-slate-500 truncate">{g.address}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openModal(g)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Products</p>
                    <p className="font-bold text-slate-900">{g._count.stock}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Stock Value</p>
                    <p className="font-bold text-slate-900 text-sm">{formatCurrency(totalStockValue(g))}</p>
                  </div>
                </div>

                {g.stock.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {expandedId === g.id ? 'Hide stock' : `View stock (${g.stock.length})`}
                    </button>
                    {expandedId === g.id && (
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {g.stock.map((s) => (
                          <div key={s.id} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                            <span className="text-slate-700 truncate pr-2">{s.product.name}</span>
                            <Badge variant={s.quantity > 10 ? 'success' : s.quantity > 0 ? 'warning' : 'danger'}>
                              {s.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !formLoading && setIsModalOpen(false)} title={editingId ? 'Edit Godown' : 'Add Godown'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Godown Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Warehouse" required />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Plot 12, Industrial Area" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Set as default godown</span>
          </label>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button type="submit" loading={formLoading}>{editingId ? 'Save Changes' : 'Add Godown'}</Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={isTransferOpen} onClose={() => !transferLoading && setIsTransferOpen(false)} title="Transfer Stock Between Godowns">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Godown *</label>
            <select
              value={transfer.fromGodownId}
              onChange={(e) => setTransfer({ ...transfer, fromGodownId: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">Select source</option>
              {godowns.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Godown *</label>
            <select
              value={transfer.toGodownId}
              onChange={(e) => setTransfer({ ...transfer, toGodownId: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">Select destination</option>
              {godowns.filter((g) => g.id !== transfer.fromGodownId).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
            <select
              value={transfer.productId}
              onChange={(e) => setTransfer({ ...transfer, productId: e.target.value })}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            >
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Input
            label="Quantity *"
            type="number"
            min="1"
            value={transfer.quantity}
            onChange={(e) => setTransfer({ ...transfer, quantity: e.target.value })}
            required
          />
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsTransferOpen(false)} disabled={transferLoading}>Cancel</Button>
            <Button type="submit" loading={transferLoading}>Transfer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

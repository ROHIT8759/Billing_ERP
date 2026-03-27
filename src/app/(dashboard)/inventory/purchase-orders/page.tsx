'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, ClipboardList, Edit2, Trash2, CheckCircle, Zap, X } from 'lucide-react'

type POItem = {
  id: string
  productName: string
  quantity: number
  price: number
  product: { id: string; name: string } | null
}

type PurchaseOrder = {
  id: string
  poNumber: string | null
  vendorName: string
  status: string
  totalAmount: number
  notes: string | null
  createdAt: string
  items: POItem[]
}

type Product = { id: string; name: string; stock: number; reorderLevel: number | null; price: number }

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  sent: 'warning',
  received: 'success',
  cancelled: 'danger',
}

type FormItem = { productId: string; productName: string; quantity: string; price: string }

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ vendorName: '', notes: '', status: 'draft' })
  const [items, setItems] = useState<FormItem[]>([{ productId: '', productName: '', quantity: '', price: '' }])

  const [receivingId, setReceivingId] = useState<string | null>(null)

  const fetchOrders = async () => {
    const res = await fetch('/api/purchase-orders')
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
    fetch('/api/products').then((r) => r.json()).then(setProducts)
  }, [])

  const autoGenerateFromLowStock = async () => {
    const res = await fetch('/api/inventory/low-stock')
    if (!res.ok) return
    const lowStock: Product[] = await res.json()
    if (lowStock.length === 0) { alert('No products are below reorder level.'); return }
    setEditingId(null)
    setForm({ vendorName: '', notes: 'Auto-generated from low-stock alert', status: 'draft' })
    setItems(lowStock.map((p) => ({
      productId: p.id,
      productName: p.name,
      quantity: p.reorderLevel != null ? String((p.reorderLevel - p.stock) * 2) : '10',
      price: String(p.price)
    })))
    setIsModalOpen(true)
  }

  const openModal = (o?: PurchaseOrder) => {
    if (o) {
      setEditingId(o.id)
      setForm({ vendorName: o.vendorName, notes: o.notes || '', status: o.status })
      setItems(o.items.map((i) => ({
        productId: i.product?.id || '',
        productName: i.productName,
        quantity: String(i.quantity),
        price: String(i.price)
      })))
    } else {
      setEditingId(null)
      setForm({ vendorName: '', notes: '', status: 'draft' })
      setItems([{ productId: '', productName: '', quantity: '', price: '' }])
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const url = editingId ? `/api/purchase-orders/${editingId}` : '/api/purchase-orders'
      const payload = {
        ...form,
        items: items.filter((i) => i.productName.trim()).map((i) => ({
          productId: i.productId || undefined,
          productName: i.productName,
          quantity: parseInt(i.quantity) || 1,
          price: parseFloat(i.price) || 0
        }))
      }
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchOrders()
      setIsModalOpen(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this purchase order?')) return
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' })
    if (res.ok) fetchOrders()
  }

  const handleReceive = async (id: string) => {
    if (!confirm('Mark this PO as received? This will create a Purchase and update stock.')) return
    setReceivingId(id)
    try {
      const res = await fetch(`/api/purchase-orders/${id}/receive`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchOrders()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setReceivingId(null)
    }
  }

  const setItemField = (idx: number, field: keyof FormItem, value: string) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'productId' && value) {
        const p = products.find((pr) => pr.id === value)
        return { ...item, productId: value, productName: p?.name || '', price: String(p?.price || '') }
      }
      return { ...item, [field]: value }
    }))
  }

  const filtered = filterStatus === 'all' ? orders : orders.filter((o) => o.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 text-sm">Create POs manually or auto-generate from low-stock alerts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoGenerateFromLowStock}>
            <Zap size={16} />
            Auto from Low Stock
          </Button>
          <Button onClick={() => openModal()}>
            <Plus size={18} /> New PO
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-1">
          {(['all', 'draft', 'sent', 'received', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <ClipboardList size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No purchase orders</h3>
            <p className="text-slate-500 text-sm mb-6">Create a PO to track your restock requests.</p>
            <Button onClick={() => openModal()}>New PO</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">PO Number</th>
                  <th className="px-6 py-4 font-medium">Vendor</th>
                  <th className="px-6 py-4 font-medium">Items</th>
                  <th className="px-6 py-4 font-medium text-right">Total</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">{o.poNumber || '—'}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{o.vendorName || <span className="text-slate-400">—</span>}</td>
                    <td className="px-6 py-4 text-slate-600">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant[o.status] ?? 'default'}>{o.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {o.status !== 'received' && o.status !== 'cancelled' && (
                          <button
                            onClick={() => handleReceive(o.id)}
                            disabled={receivingId === o.id}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark as Received"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {o.status === 'draft' && (
                          <button onClick={() => openModal(o)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                            <Edit2 size={15} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(o.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={15} />
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

      <Modal isOpen={isModalOpen} onClose={() => !formLoading && setIsModalOpen(false)} title={editingId ? 'Edit Purchase Order' : 'New Purchase Order'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Vendor Name" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Supplier / Vendor" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {['draft', 'sent', 'received', 'cancelled'].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Items *</label>
              <button type="button" onClick={() => setItems([...items, { productId: '', productName: '', quantity: '', price: '' }])} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                + Add Row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <select
                      value={item.productId}
                      onChange={(e) => setItemField(idx, 'productId', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    >
                      <option value="">Custom item</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      placeholder="Product name"
                      value={item.productName}
                      onChange={(e) => setItemField(idx, 'productName', e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => setItemField(idx, 'quantity', e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => setItemField(idx, 'price', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button type="submit" loading={formLoading}>{editingId ? 'Save Changes' : 'Create PO'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

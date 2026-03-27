'use client'

import { useEffect, useState } from 'react'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Building2, Edit2, Plus, Search, Trash2, Truck, Wallet } from 'lucide-react'

type Supplier = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  createdAt: string
  account: {
    id: string
    name: string
    openingBalance: number
  } | null
  outstandingBalance: number
  totalPurchases: number
  lastPurchaseAt: string | null
  purchaseCount: number
}

type SupplierResponse = {
  summary: {
    totalSuppliers: number
    totalPayables: number
    totalPurchases: number
    suppliersWithDues: number
  }
  suppliers: Supplier[]
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  openingBalance: '0',
}

export default function SuppliersPage() {
  const [data, setData] = useState<SupplierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to fetch suppliers')
      setData(payload)
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch suppliers'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        openingBalance: String(Number(supplier.account?.openingBalance || 0)),
      })
    } else {
      setEditingSupplier(null)
      setFormData(emptyForm)
    }

    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const res = await fetch(
        editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers',
        {
          method: editingSupplier ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            openingBalance: Number(formData.openingBalance || 0),
          }),
        }
      )

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to save supplier')

      await fetchSuppliers()
      setIsModalOpen(false)
      setEditingSupplier(null)
      setFormData(emptyForm)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save supplier'
      alert(message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (supplierId: string) => {
    if (!confirm('Delete this supplier? Existing purchase-linked suppliers cannot be removed.')) return

    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to delete supplier')
      await fetchSuppliers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete supplier'
      alert(message)
    }
  }

  const suppliers = data?.suppliers || []
  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = search.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.phone?.includes(search) ||
      supplier.email?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">
            Track vendors, contact details, purchase history, and outstanding balances.
          </p>
        </div>
        <Button onClick={() => openModal()} className="w-full sm:w-auto">
          <Plus size={18} />
          Add Supplier
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Suppliers"
          value={data?.summary.totalSuppliers || 0}
          icon={<Building2 size={22} />}
          color="indigo"
        />
        <StatCard
          title="Outstanding Payables"
          value={formatCurrency(data?.summary.totalPayables || 0)}
          icon={<Wallet size={22} />}
          color="amber"
        />
        <StatCard
          title="Purchase Value"
          value={formatCurrency(data?.summary.totalPurchases || 0)}
          icon={<Truck size={22} />}
          color="emerald"
        />
        <StatCard
          title="Suppliers With Dues"
          value={data?.summary.suppliersWithDues || 0}
          icon={<Building2 size={22} />}
          color="violet"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search suppliers by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading suppliers...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <Building2 size={32} />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">No suppliers found</h3>
            <p className="max-w-sm text-sm text-slate-500">
              {search
                ? 'Try adjusting your search query.'
                : 'Add vendors here so purchases can be linked and outstanding balances stay visible.'}
            </p>
            {!search && (
              <Button onClick={() => openModal()} variant="outline" className="mt-6">
                Add Supplier
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Purchases</th>
                  <th className="px-6 py-4 font-medium">Outstanding</th>
                  <th className="px-6 py-4 font-medium">Last Purchase</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{supplier.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {supplier.account?.name || 'Creditor ledger pending'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        {supplier.phone ? (
                          <span className="text-slate-900">{supplier.phone}</span>
                        ) : (
                          <span className="text-xs text-slate-400">No phone</span>
                        )}
                        {supplier.email && <span className="text-xs text-slate-500">{supplier.email}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <Badge variant={supplier.purchaseCount > 0 ? 'info' : 'default'}>
                          {supplier.purchaseCount} purchases
                        </Badge>
                        <p className="text-xs text-slate-500">{formatCurrency(supplier.totalPurchases)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          supplier.outstandingBalance > 0
                            ? 'font-semibold text-amber-700'
                            : 'font-medium text-emerald-600'
                        }
                      >
                        {formatCurrency(supplier.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {supplier.lastPurchaseAt ? formatDate(supplier.lastPurchaseAt) : 'No purchases yet'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(supplier)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit supplier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete supplier"
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => !formLoading && setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Supplier Name *"
            value={formData.name}
            onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
            placeholder="e.g. Samsung Distributors"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((current) => ({ ...current, phone: e.target.value }))}
              placeholder="9876543210"
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
              placeholder="vendor@example.com"
            />
          </div>
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData((current) => ({ ...current, address: e.target.value }))}
            placeholder="Enter supplier address"
          />
          <Input
            label="Opening Outstanding"
            type="number"
            min="0"
            step="0.01"
            value={formData.openingBalance}
            onChange={(e) =>
              setFormData((current) => ({ ...current, openingBalance: e.target.value }))
            }
            placeholder="0.00"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingSupplier ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

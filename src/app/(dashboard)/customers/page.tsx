'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatDate, INDIA_STATES } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  state: string | null
  priceLevel: string
  createdAt: string
  _count: { invoices: number }
}

const PRICE_LEVELS = ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MRP']

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    priceLevel: 'RETAIL',
  })

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      if (!res.ok) throw new Error('Failed to fetch customers')
      const data = await res.json()
      setCustomers(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingId(customer.id)
      setFormData({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        state: customer.state || '',
        priceLevel: customer.priceLevel || 'RETAIL',
      })
    } else {
      setEditingId(null)
      setFormData({ name: '', phone: '', email: '', address: '', state: '', priceLevel: 'RETAIL' })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const url = editingId ? `/api/customers/${editingId}` : '/api/customers'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save customer')
      }

      await fetchCustomers()
      setIsModalOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? All their invoices will also be deleted.')) return

    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete customer')
      await fetchCustomers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm">Manage your clients and their details</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="sm:w-auto w-full">
          <Plus size={18} />
          Add Customer
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search customers by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading customers...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No customers found</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              {search ? 'Try adjusting your search query.' : 'Get started by adding your first customer.'}
            </p>
            {!search && (
              <Button onClick={() => handleOpenModal()} variant="outline" className="mt-6">
                Add Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Customer Name</th>
                  <th className="px-3 py-2 font-semibold">Contact</th>
                  <th className="px-3 py-2 font-semibold">Invoices</th>
                  <th className="px-3 py-2 font-semibold">Added On</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-3 py-2 border-r border-slate-50">
                      <p className="font-semibold text-slate-900">{customer.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {customer.priceLevel || 'RETAIL'}
                        </span>
                        {customer.address && <span className="text-[10px] text-slate-500 truncate max-w-40">{customer.address}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-50">
                      <div className="flex flex-col gap-0.5">
                        {customer.phone ? <span className="text-slate-900">{customer.phone}</span> : <span className="text-slate-400 text-[11px]">No phone</span>}
                        {customer.email && <span className="text-slate-500 text-[11px]">{customer.email}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-50">
                      <Badge variant={customer._count.invoices > 0 ? 'info' : 'default'}>
                        {customer._count.invoices} invoices
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-50">{formatDate(customer.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(customer)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => !formLoading && setIsModalOpen(false)}
        title={editingId ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Customer Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. John Doe"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="9876543210"
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter full address"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">State (for GST)</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">Select state…</option>
                {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Price Level</label>
              <select
                value={formData.priceLevel}
                onChange={(e) => setFormData({ ...formData, priceLevel: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {PRICE_LEVELS.map(pl => <option key={pl} value={pl}>{pl}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingId ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { formatCurrency } from '@/lib/utils'
import { Edit2, Plus, Trash2, Users } from 'lucide-react'

type Account = {
  id: string
  code: string
  name: string
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
  type: string
  isSystem: boolean
  balance: number
}

type Supplier = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  account?: { id: string; name: string } | null
  purchases: { id: string }[]
}

const categoryOptions = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
]

export default function LedgersPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [accountForm, setAccountForm] = useState({
    name: '',
    category: 'EXPENSE',
    openingBalance: '0',
  })
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })

  const fetchData = async () => {
    try {
      const [accountsRes, suppliersRes] = await Promise.all([
        fetch('/api/accounting/accounts'),
        fetch('/api/accounting/suppliers'),
      ])

      const [accountsData, suppliersData] = await Promise.all([
        accountsRes.json(),
        suppliersRes.json(),
      ])

      if (!accountsRes.ok) throw new Error(accountsData.error || 'Failed to load accounts')
      if (!suppliersRes.ok) throw new Error(suppliersData.error || 'Failed to load suppliers')

      setAccounts(accountsData)
      setSuppliers(suppliersData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredAccounts = useMemo(() => {
    const query = search.toLowerCase()
    return accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(query) ||
        account.code.toLowerCase().includes(query) ||
        account.type.toLowerCase().includes(query)
    )
  }, [accounts, search])

  const debtorAccounts = accounts.filter((account) => account.type === 'CUSTOMER')
  const creditorAccounts = accounts.filter((account) => account.type === 'SUPPLIER')

  const resetSupplierForm = () => {
    setEditingSupplierId(null)
    setSupplierForm({ name: '', phone: '', email: '', address: '' })
  }

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create account')

      setAccountModalOpen(false)
      setAccountForm({ name: '', category: 'EXPENSE', openingBalance: '0' })
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openSupplierModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplierId(supplier.id)
      setSupplierForm({
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
      })
    } else {
      resetSupplierForm()
    }

    setSupplierModalOpen(true)
  }

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const res = await fetch(
        editingSupplierId ? `/api/accounting/suppliers/${editingSupplierId}` : '/api/accounting/suppliers',
        {
          method: editingSupplierId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplierForm),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save supplier')

      setSupplierModalOpen(false)
      resetSupplierForm()
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const deleteSupplier = async (supplierId: string) => {
    if (!confirm('Delete this supplier? Existing purchase-linked suppliers cannot be removed.')) return

    try {
      const res = await fetch(`/api/accounting/suppliers/${supplierId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete supplier')
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading ledgers...</div>
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ledgers & Chart of Accounts</h1>
          <p className="text-sm text-slate-500">
            Track debtors, creditors, bank, cash, and manual expense heads from one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => openSupplierModal()}>
            <Users size={18} />
            Add Supplier
          </Button>
          <Button onClick={() => setAccountModalOpen(true)}>
            <Plus size={18} />
            New Account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-slate-500">Customer Ledgers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{debtorAccounts.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            {formatCurrency(debtorAccounts.reduce((sum, account) => sum + account.balance, 0))} outstanding
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Supplier Ledgers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{creditorAccounts.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            {formatCurrency(creditorAccounts.reduce((sum, account) => sum + account.balance, 0))} payable
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Total Accounts</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{accounts.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            {accounts.filter((account) => account.isSystem).length} system-defined ledgers
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts by code, name, or type..."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Ledger</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">{account.code}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{account.name}</span>
                      {account.isSystem && <Badge variant="info">System</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{account.category}</td>
                  <td className="px-6 py-4 text-slate-600">{account.type.replaceAll('_', ' ')}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">
                    {formatCurrency(account.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Suppliers / Creditors</h2>
            <p className="text-sm text-slate-500">
              Payments and purchase vouchers automatically post against these ledgers.
            </p>
          </div>
          <Button variant="outline" onClick={() => openSupplierModal()}>
            <Plus size={18} />
            Add Supplier
          </Button>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No suppliers added yet. Purchases will also auto-create suppliers by vendor name.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Ledger</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Purchases</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-slate-600">{supplier.account?.name || 'Not linked yet'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {supplier.phone || supplier.email || 'No contact details'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{supplier.purchases.length}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openSupplierModal(supplier)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit supplier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteSupplier(supplier.id)}
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
        isOpen={accountModalOpen}
        onClose={() => !formLoading && setAccountModalOpen(false)}
        title="Create Ledger Account"
      >
        <form className="space-y-4" onSubmit={submitAccount}>
          <Input
            label="Account Name *"
            value={accountForm.name}
            onChange={(e) => setAccountForm((current) => ({ ...current, name: e.target.value }))}
            placeholder="e.g. Office Rent"
            required
          />
          <Select
            label="Category *"
            value={accountForm.category}
            onChange={(e) => setAccountForm((current) => ({ ...current, category: e.target.value }))}
            options={categoryOptions}
          />
          <Input
            label="Opening Balance"
            type="number"
            min="0"
            step="0.01"
            value={accountForm.openingBalance}
            onChange={(e) =>
              setAccountForm((current) => ({ ...current, openingBalance: e.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Save Account
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={supplierModalOpen}
        onClose={() => !formLoading && setSupplierModalOpen(false)}
        title={editingSupplierId ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form className="space-y-4" onSubmit={submitSupplier}>
          <Input
            label="Supplier Name *"
            value={supplierForm.name}
            onChange={(e) => setSupplierForm((current) => ({ ...current, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm((current) => ({ ...current, phone: e.target.value }))}
            />
            <Input
              label="Email"
              value={supplierForm.email}
              onChange={(e) => setSupplierForm((current) => ({ ...current, email: e.target.value }))}
            />
          </div>
          <Input
            label="Address"
            value={supplierForm.address}
            onChange={(e) => setSupplierForm((current) => ({ ...current, address: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSupplierModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingSupplierId ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

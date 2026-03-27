'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Eye, Trash2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

type Invoice = {
  id: string
  invoiceNo: string
  totalAmount: number
  gstAmount: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: string
  status: string
  dueDate: string | null
  createdAt: string
  customer: { name: string }
  items: { id: string }[]
}

function paymentBadge(s: string): { variant: 'success' | 'warning' | 'danger' | 'default'; label: string } {
  switch (s) {
    case 'PAID':    return { variant: 'success', label: 'Paid' }
    case 'PARTIAL': return { variant: 'warning', label: 'Partial' }
    case 'OVERDUE': return { variant: 'danger',  label: 'Overdue' }
    default:        return { variant: 'danger',  label: 'Unpaid' }
  }
}

export default function SalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices')
      if (!res.ok) throw new Error('Failed to fetch invoices')
      const data = await res.json()
      setInvoices(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice? Stock will be restocked.')) return
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete invoice')
      await fetchInvoices()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) || 
    inv.customer.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Invoices</h1>
          <p className="text-slate-500 text-sm">Manage your sales, billing, and receipts</p>
        </div>
        <Link href="/sales/new">
          <Button className="sm:w-auto w-full">
            <Plus size={18} />
            Create Invoice
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by invoice number or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading invoices...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-400">
              <ShoppingCart size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No invoices found</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              {search ? 'Try adjusting your search query.' : 'Create your first invoice to start billing customers.'}
            </p>
            {!search && (
              <Link href="/sales/new">
                <Button variant="outline" className="mt-6">
                  Create Invoice
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Invoice No</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold text-right">Outstanding</th>
                  <th className="px-3 py-2 font-semibold text-center">Payment</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold text-indigo-600 border-r border-slate-50">{invoice.invoiceNo}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900 border-r border-slate-50">{invoice.customer.name}</td>
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-50">{formatDate(invoice.createdAt)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 border-r border-slate-50">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-slate-50">
                      {invoice.outstandingAmount > 0 ? (
                        <span className="font-semibold text-red-600">{formatCurrency(invoice.outstandingAmount)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-50">
                      {(() => { const b = paymentBadge(invoice.paymentStatus); return <Badge variant={b.variant}>{b.label}</Badge> })()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/sales/${invoice.id}`}>
                          <button
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Detail"
                          >
                            <Eye size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(invoice.id)}
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

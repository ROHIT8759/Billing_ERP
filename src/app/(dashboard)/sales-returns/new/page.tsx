'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { RotateCcw, Search, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NewSalesReturnPage() {
  const router = useRouter()
  
  // Step 1: Search Invoice
  const [searchTerm, setSearchTerm] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  
  // Step 2: Selected Invoice & Return Data
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [reason, setReason] = useState('')
  
  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchInvoices = async () => {
    if (!searchTerm.trim()) return
    setSearching(true)
    setError('')
    try {
      // For simplicity, we fetch all and filter client side. In production with thousands of invoices, build a search endpoint.
      const res = await fetch('/api/invoices')
      const data = await res.json()
      const matches = data.filter((inv: any) => 
        inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setInvoices(matches)
    } catch (err: any) {
      setError('Failed to search invoices')
    } finally {
      setSearching(false)
    }
  }

  const selectInvoice = (invoice: any) => {
    setSelectedInvoice(invoice)
    // Initialize return quantities to 0
    setReturnItems(invoice.items.map((item: any) => ({
      ...item,
      returnQty: 0
    })))
  }

  const updateReturnQty = (index: number, qty: string) => {
    const parsed = parseInt(qty, 10) || 0
    const item = returnItems[index]
    const validQty = Math.max(0, Math.min(parsed, item.quantity)) // cannot return more than purchased

    const newItems = [...returnItems]
    newItems[index].returnQty = validQty
    setReturnItems(newItems)
  }

  const calculatedTotal = returnItems.reduce((sum, item) => sum + (item.returnQty * item.price), 0)

  const handleSubmit = async () => {
    if (calculatedTotal <= 0) {
      setError('You must return at least one item to generate a credit note.')
      return
    }

    setSubmitting(true)
    setError('')
    
    try {
      const payload = {
        invoiceId: selectedInvoice.id,
        reason,
        totalAmount: calculatedTotal,
        items: returnItems
          .filter(item => item.returnQty > 0)
          .map(item => ({
            invoiceItemId: item.id,
            productId: item.productId,
            quantity: item.returnQty,
            rate: item.price,
            amount: item.returnQty * item.price
          }))
      }

      const res = await fetch('/api/sales-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate credit note')
      }

      router.push('/sales-returns')
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/sales-returns" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={24} className="text-indigo-600" /> New Credit Note
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select an invoice and specify return quantities</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}

      {!selectedInvoice ? (
        <Card className="p-6">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <Search size={48} className="mx-auto text-slate-200 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800">Find the Original Invoice</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6">Enter the invoice number or customer name to begin.</p>
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="e.g. INV-2026... or John Doe" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchInvoices()}
              />
              <Button onClick={searchInvoices} loading={searching}>Search</Button>
            </div>

            {invoices.length > 0 && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {invoices.map(inv => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{inv.invoiceNo || 'Draft'}</p>
                      <p className="text-sm text-slate-500">{inv.customer.name} • {formatCurrency(inv.totalAmount)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => selectInvoice(inv)}>Select</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-0 overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Original Invoice: {selectedInvoice.invoiceNo}</h3>
                  <p className="text-sm text-slate-500">Customer: {selectedInvoice.customer.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>Change Invoice</Button>
              </div>

              <div className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Sold Qty</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-center">Return Qty</th>
                      <th className="px-4 py-3 text-right">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {returnItems.map((item, idx) => (
                      <tr key={item.id} className={item.returnQty > 0 ? 'bg-indigo-50/30' : ''}>
                        <td className="px-4 py-3 font-medium">{item.product?.name || `Product ${item.productId.substring(0,6)}`}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-center w-32">
                          <input 
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={item.returnQty || ''}
                            onChange={(e) => updateReturnQty(idx, e.target.value)}
                            className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatCurrency(item.returnQty * item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
              
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-indigo-600"/> Credit Note Summary
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Items Selected</span>
                  <span className="font-medium">{returnItems.filter(i => i.returnQty > 0).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Return Qty</span>
                  <span className="font-medium">{returnItems.reduce((acc, i) => acc + i.returnQty, 0)}</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Total Credit</span>
                  <span className="text-2xl font-black text-rose-600">{formatCurrency(calculatedTotal)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason for Return</label>
                  <textarea 
                    rows={3}
                    placeholder="e.g. Items damaged in transit, Expired goods..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />
                </div>

                <Button 
                  className="w-full py-6 shadow-xl shadow-indigo-600/20" 
                  onClick={handleSubmit} 
                  loading={submitting}
                  disabled={calculatedTotal <= 0}
                >
                  Generate Credit Note
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

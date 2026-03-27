'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Printer, Download, Store } from 'lucide-react'
import Link from 'next/link'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params)
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${unwrappedParams.id}`)
        if (!res.ok) throw new Error('Failed to fetch invoice')
        const data = await res.json()
        setInvoice(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoice()
  }, [unwrappedParams.id])

  if (loading) return <div className="p-10 text-center text-slate-500">Loading invoice details...</div>
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>
  if (!invoice) return <div className="p-10 text-center text-slate-500">Invoice not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/sales">
            <Button variant="ghost" className="p-2">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Invoice {invoice.invoiceNo}</h1>
            <p className="text-slate-500 text-sm">Created on {formatDate(invoice.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer size={16} /> Print
          </Button>
          <Button variant="primary" className="print:hidden">
            <Download size={16} /> Download PDF
          </Button>
        </div>
      </div>

      {/* Printable Invoice Card */}
      <Card className="p-10 bg-white">
        {/* Invoice Header */}
        <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-100 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Store size={20} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{invoice.shop.shopName}</h2>
            </div>
            <p className="text-slate-500 text-sm max-w-xs">{invoice.shop.address}</p>
            <p className="text-slate-500 text-sm mt-1">{invoice.shop.state}, {invoice.shop.pincode}</p>
            <p className="text-slate-500 text-sm mt-1">Phone: {invoice.shop.phone}</p>
            {invoice.shop.gstNumber && (
              <p className="text-slate-500 text-sm mt-1 font-medium text-slate-700">GSTIN: {invoice.shop.gstNumber}</p>
            )}
          </div>
          <div className="mt-8 md:mt-0 text-left md:text-right">
            <h1 className="text-4xl font-black text-slate-200 uppercase tracking-widest mb-2">INVOICE</h1>
            <Badge variant="success" className="mb-4 inline-flex items-center px-3 py-1 text-sm border-0">
              {invoice.status.toUpperCase()}
            </Badge>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-4">
              <span className="text-slate-500 font-medium">Invoice No:</span>
              <span className="text-slate-900 font-semibold">{invoice.invoiceNo}</span>
              
              <span className="text-slate-500 font-medium">Date:</span>
              <span className="text-slate-900">{formatDate(invoice.createdAt)}</span>
              
              <span className="text-slate-500 font-medium">Total Due:</span>
              <span className="text-indigo-600 font-bold">{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bill To</h3>
          <p className="text-base font-semibold text-slate-900">{invoice.customer.name}</p>
          {invoice.customer.address && <p className="text-sm text-slate-500 mt-1 max-w-xs">{invoice.customer.address}</p>}
          {invoice.customer.phone && <p className="text-sm text-slate-500 mt-1">Phone: {invoice.customer.phone}</p>}
          {invoice.customer.email && <p className="text-sm text-slate-500 mt-1">Email: {invoice.customer.email}</p>}
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/50">
              <tr>
                <th className="py-3 px-4 font-semibold text-slate-700 w-12">#</th>
                <th className="py-3 px-4 font-semibold text-slate-700">Item Description</th>
                <th className="py-3 px-4 font-semibold text-slate-700 text-right w-32">Price</th>
                <th className="py-3 px-4 font-semibold text-slate-700 text-right w-24">Qty</th>
                <th className="py-3 px-4 font-semibold text-slate-700 text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 border-b border-slate-100">
              {invoice.items.map((item: any, i: number) => (
                <tr key={item.id} className="hover:bg-slate-50/20">
                  <td className="py-4 px-4 text-slate-500">{i + 1}</td>
                  <td className="py-4 px-4 text-slate-900 font-medium">{item.product.name}</td>
                  <td className="py-4 px-4 text-right text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="py-4 px-4 text-right text-slate-600">{item.quantity}</td>
                  <td className="py-4 px-4 text-right text-slate-900 font-medium">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-3">
            <div className="flex justify-between text-sm py-2">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-900 font-medium">{formatCurrency(invoice.totalAmount - invoice.gstAmount)}</span>
            </div>
            {invoice.gstAmount > 0 && (
              <div className="flex justify-between text-sm py-2 text-slate-500">
                <span>GST (18%)</span>
                <span>{formatCurrency(invoice.gstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-4 border-t-2 border-slate-900 shadow-sm mt-2">
              <span className="text-lg font-bold text-slate-900">Total Amount</span>
              <span className="text-lg font-black text-indigo-600">{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-100 text-center text-sm text-slate-400">
          <p>Thank you for your business!</p>
          <p className="mt-1">For any queries, please contact {invoice.shop.email || invoice.shop.phone}</p>
        </div>
      </Card>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .max-w-4xl, .max-w-4xl * { visibility: visible; }
          .max-w-4xl { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  )
}

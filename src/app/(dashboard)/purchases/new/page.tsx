'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft, Truck } from 'lucide-react'
import Link from 'next/link'

type LineItem = { productName: string; quantity: number; price: number }

export default function NewPurchasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [vendorName, setVendorName] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productName: '', quantity: 1, price: 0 }
  ])

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length === 1) return
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  // Calculate totals
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!vendorName) return setError('Please enter vendor name')
    if (items.some(i => !i.productName)) return setError('Please enter product names for all rows')
    if (items.length === 0) return setError('Please add at least one product')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName,
          items,
          totalAmount
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to record purchase')
      }

      router.push('/purchases')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/purchases">
          <Button variant="ghost" className="p-2">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Purchase</h1>
          <p className="text-slate-500 text-sm">Manually enter stock outwards from an invoice</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
          <Truck size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">1</span>
                Vendor Details
              </h3>
              
              <Input
                label="Vendor Name *"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Samsung Distributors"
                required
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">2</span>
                Line Items
              </h3>
              
              <p className="text-xs text-slate-500 mb-4">
                Tip: If the product name matches exactly with an existing product in your catalog, its stock will be automatically incremented.
              </p>

              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">
                  <div className="col-span-5">Product Name</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div className="col-span-1 md:col-span-5">
                      <Input
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        placeholder="e.g. Wireless Mouse"
                        required
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                          required
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                        required
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 flex items-center md:h-[42px] justify-between md:justify-end">
                      <span className="md:hidden text-sm text-slate-500">Row Total:</span>
                      <span className="font-medium text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                    </div>

                    <div className="col-span-1 flex items-center justify-end md:h-[42px]">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed border-2 bg-transparent hover:bg-slate-50">
                  <Plus size={16} /> Add Another Item
                </Button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">3</span>
                Summary
              </h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between py-4 border-b border-slate-100">
                  <span className="font-semibold text-slate-900">Total Purchase</span>
                  <span className="font-bold text-indigo-600 text-lg">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl mb-6 text-sm text-slate-600 leading-relaxed border border-slate-100">
                <p><span className="font-medium text-slate-900">Vendor:</span> {vendorName || 'Not entered'}</p>
                <p><span className="font-medium text-slate-900">Line Items:</span> {items.length}</p>
              </div>

              <Button type="submit" size="lg" className="w-full bg-amber-600 hover:bg-amber-700 focus:ring-amber-500" loading={loading}>
                Save Purchase Entry
              </Button>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}

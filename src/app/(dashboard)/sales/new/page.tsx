'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatCurrency, GST_RATE } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft, Receipt } from 'lucide-react'
import Link from 'next/link'

type Customer = { id: string; name: string }
type Product = { id: string; name: string; price: number; stock: number }
type LineItem = { productId: string; quantity: number; price: number; name?: string }

export default function NewInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', quantity: 1, price: 0 }
  ])

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ]).then(([custData, prodData]) => {
      setCustomers(custData)
      setProducts(prodData.filter((p: Product) => p.stock > 0)) // Only products in stock
    }).catch(err => {
      setError('Failed to load customers or products')
    })
  }, [])

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      productId,
      price: product.price,
      name: product.name
    }
    setItems(newItems)
  }

  const handleQuantityChange = (index: number, quantity: number) => {
    const product = products.find(p => p.id === items[index].productId)
    if (product && quantity > product.stock) {
      alert(`Only ${product.stock} units available in stock.`)
      quantity = product.stock
    }

    const newItems = [...items]
    newItems[index].quantity = Math.max(1, quantity)
    setItems(newItems)
  }

  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...items]
    newItems[index].price = Math.max(0, price)
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length === 1) return
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const gstAmount = subtotal * GST_RATE
  const totalAmount = subtotal + gstAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!customerId) return setError('Please select a customer')
    if (items.some(i => !i.productId)) return setError('Please select a product for all rows')
    if (items.length === 0) return setError('Please add at least one product')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price
          })),
          totalAmount,
          gstAmount
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create invoice')
      }

      const invoice = await res.json()
      router.push(`/sales/${invoice.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const selectedCustomer = customers.find(c => c.id === customerId)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/sales">
          <Button variant="ghost" className="p-2">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Invoice</h1>
          <p className="text-slate-500 text-sm">Fill in the details to generate a bill</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
          <Receipt size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">1</span>
                Customer Details
              </h3>
              
              <Select
                label="Select Customer *"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Choose a customer..."
                required
              />
              
              {customers.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  No customers found. Please add a customer first.
                </p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">2</span>
                Line Items
              </h3>

              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div className="col-span-1 md:col-span-5">
                      <Select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        options={products.map(p => ({ 
                          value: p.id, 
                          label: `${p.name} (${p.stock} in stock)`
                        }))}
                        placeholder="Select product"
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
                          onChange={(e) => handlePriceChange(index, parseFloat(e.target.value))}
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
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10))}
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
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">3</span>
                Summary
              </h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">GST ({(GST_RATE * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <span className="font-semibold text-slate-900">Total Amount</span>
                  <span className="font-bold text-indigo-600 text-lg">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl mb-6 text-sm text-slate-600 leading-relaxed border border-slate-100">
                <p><span className="font-medium text-slate-900">Customer:</span> {selectedCustomer ? selectedCustomer.name : 'Not selected'}</p>
                <p><span className="font-medium text-slate-900">Items:</span> {items.length}</p>
              </div>

              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={products.length === 0}>
                Generate Invoice
              </Button>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}

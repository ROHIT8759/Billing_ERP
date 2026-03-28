'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { calcGST, cn, formatCurrency } from '@/lib/utils'

type Customer = {
  id: string
  name: string
  state?: string | null
  phone?: string | null
  priceLevel?: string | null
}

type Product = {
  id: string
  name: string
  stock: number
  price: number
  gstRate: number
  hsnCode?: string | null
  mrp?: number | null
  retailRate?: number | null
  wholesaleRate?: number | null
  distributorRate?: number | null
}

type DbScheme = {
  id: string
  productId: string
  type: string    // FREE_QTY | PERCENTAGE
  minQty: number
  freeQty: number
  discountPct: number
  isActive: boolean
  endDate: string | null
}

type Shop = {
  id: string
  state?: string | null
}

type SaleRow = {
  productId: string
  quantity: string
  freeQty: string
  schemeId: string | null
  rate: string
  discountPct: string
}

type ApiError = {
  error?: string
}

const EMPTY_ROW: SaleRow = {
  productId: '',
  quantity: '1',
  freeQty: '0',
  schemeId: null,
  rate: '',
  discountPct: '0',
}

function getRateForPriceLevel(product: Product, priceLevel?: string | null): number {
  switch (priceLevel) {
    case 'MRP': return product.mrp ?? product.price
    case 'WHOLESALE': return product.wholesaleRate ?? product.price
    case 'DISTRIBUTOR': return product.distributorRate ?? product.price
    default: return product.retailRate ?? product.price
  }
}

function applyScheme(
  billedQty: number,
  schemes: DbScheme[],
  productId: string,
): { freeQty: number; schemeId: string | null } {
  const now = new Date()
  const scheme = schemes.find(
    s => s.productId === productId &&
      s.isActive &&
      s.type === 'FREE_QTY' &&
      (!s.endDate || new Date(s.endDate) >= now) &&
      billedQty >= s.minQty
  )
  if (!scheme) return { freeQty: 0, schemeId: null }
  const free = Math.floor(billedQty / scheme.minQty) * scheme.freeQty
  return { freeQty: free, schemeId: scheme.id }
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [schemes, setSchemes] = useState<DbScheme[]>([])
  const [shop, setShop] = useState<Shop | null>(null)
  const [cashDiscountPct, setCashDiscountPct] = useState('0')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [paymentTermDays, setPaymentTermDays] = useState('0')
  const [initialPaymentAmount, setInitialPaymentAmount] = useState('0')
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SaleRow[]>([{ ...EMPTY_ROW }])

  useEffect(() => {
    let ignore = false

    async function loadData() {
      setLoading(true)
      setLoadError('')

      try {
        const [customersRes, productsRes, shopRes, schemesRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/products'),
          fetch('/api/shop'),
          fetch('/api/schemes'),
        ])

        const [customersData, productsData, shopData, schemesData] = await Promise.all([
          customersRes.json(),
          productsRes.json(),
          shopRes.json(),
          schemesRes.json(),
        ])

        if (!customersRes.ok) {
          throw new Error((customersData as ApiError).error || 'Failed to load customers')
        }
        if (!productsRes.ok) {
          throw new Error((productsData as ApiError).error || 'Failed to load products')
        }
        if (!shopRes.ok) {
          throw new Error((shopData as ApiError).error || 'Failed to load shop')
        }

        if (ignore) return

        setCustomers(Array.isArray(customersData) ? customersData : [])
        setProducts(Array.isArray(productsData) ? productsData : [])
        setShop(shopData)
        setSchemes(Array.isArray(schemesData) ? schemesData : [])
      } catch (error: unknown) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load sale form')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      ignore = true
    }
  }, [])

  const customer = customers.find((entry) => entry.id === customerId) || null

  const computedRows = useMemo(() => {
    return items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      const billedQty = parseInteger(item.quantity)
      const freeQty = parseInteger(item.freeQty)
      const rate = parseNumber(item.rate || String(product?.price ?? 0))
      const discountPct = parseNumber(item.discountPct)
      const taxableAmount = billedQty * rate * (1 - discountPct / 100)
      const stockImpactQty = billedQty + freeQty
      const sameState = !shop?.state || !customer?.state || shop.state === customer.state
      const gstBreakdown = calcGST(taxableAmount, product?.gstRate ?? 18, sameState)

      return {
        item,
        product,
        billedQty,
        freeQty,
        stockImpactQty,
        rate,
        discountPct,
        taxableAmount,
        totalAmount: taxableAmount + gstBreakdown.gstAmount,
        ...gstBreakdown,
      }
    })
  }, [customer?.state, items, products, shop?.state])

  const totals = useMemo(() => {
    return computedRows.reduce(
      (acc, row) => {
        acc.subtotal += row.billedQty * row.rate
        acc.discountAmount += row.billedQty * row.rate - row.taxableAmount
        acc.taxableAmount += row.taxableAmount
        acc.gstAmount += row.gstAmount
        acc.cgstAmount += row.cgstAmount
        acc.sgstAmount += row.sgstAmount
        acc.igstAmount += row.igstAmount
        acc.totalAmount += row.totalAmount
        return acc
      },
      {
        subtotal: 0,
        discountAmount: 0,
        taxableAmount: 0,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalAmount: 0,
      }
    )
  }, [computedRows])

  const filteredRows = computedRows.filter((row) => row.product && row.billedQty > 0)
  const initialPaymentValue = parseNumber(initialPaymentAmount)

  const updateRow = (index: number, patch: Partial<SaleRow>) => {
    setItems((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        const next = { ...row, ...patch }

        // Auto-set rate when product changes (respects customer price level)
        if (patch.productId) {
          const product = products.find((entry) => entry.id === patch.productId)
          if (product) {
            const priceLevel = customers.find(c => c.id === customerId)?.priceLevel
            next.rate = String(getRateForPriceLevel(product, priceLevel))
          }
          // Auto-apply scheme for new product
          const bQty = parseInteger(next.quantity)
          const { freeQty, schemeId } = applyScheme(bQty, schemes, next.productId)
          next.freeQty = String(freeQty)
          next.schemeId = schemeId
        }

        // Re-check scheme when quantity changes
        if (patch.quantity !== undefined && next.productId) {
          const bQty = parseInteger(next.quantity)
          const { freeQty, schemeId } = applyScheme(bQty, schemes, next.productId)
          next.freeQty = String(freeQty)
          next.schemeId = schemeId
        }

        return next
      })
    )
  }

  const handleCustomerChange = (newCustomerId: string) => {
    setCustomerId(newCustomerId)
    const priceLevel = customers.find(c => c.id === newCustomerId)?.priceLevel
    setItems((current) =>
      current.map((row) => {
        if (!row.productId) return row
        const product = products.find(p => p.id === row.productId)
        if (!product) return row
        return { ...row, rate: String(getRateForPriceLevel(product, priceLevel)) }
      })
    )
  }

  const addRow = () => {
    setItems((current) => [...current, { ...EMPTY_ROW }])
  }

  const removeRow = (index: number) => {
    setItems((current) => {
      if (current.length === 1) return [{ ...EMPTY_ROW }]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const handleSubmit = async () => {
    setSubmitError('')

    if (!customerId) {
      setSubmitError('Select a customer before generating the invoice.')
      return
    }

    if (filteredRows.length === 0) {
      setSubmitError('Add at least one valid product row.')
      return
    }

    const stockErrorRow = filteredRows.find(
      (row) => row.product && row.stockImpactQty > row.product.stock
    )
    if (stockErrorRow?.product) {
      setSubmitError(`Insufficient stock for ${stockErrorRow.product.name}.`)
      return
    }

    if (initialPaymentValue > totals.totalAmount) {
      setSubmitError('Initial payment amount cannot exceed the invoice total.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: filteredRows.map((row) => ({
            productId: row.product!.id,
            quantity: row.stockImpactQty,
            billedQty: row.billedQty,
            freeQty: row.freeQty,
            schemeId: row.item.schemeId,
            price: row.rate,
            discountPct: row.discountPct,
            hsnCode: row.product?.hsnCode || null,
            taxRate: row.product?.gstRate ?? 18,
          })),
          subtotal: totals.taxableAmount,
          discountAmount: totals.discountAmount,
          discountType: totals.discountAmount > 0 ? 'trade' : 'none',
          cashDiscountPct: parseNumber(cashDiscountPct),
          cashDiscountAmount: totals.taxableAmount * parseNumber(cashDiscountPct) / 100,
          totalAmount: totals.totalAmount,
          gstAmount: totals.gstAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          paymentTermDays,
          initialPaymentAmount: initialPaymentValue,
          paymentMode,
          notes,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error((data as ApiError).error || 'Failed to create invoice')
      }

      startTransition(() => {
        router.push(`/sales/${data.id}`)
      })
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  const customerOptions = customers.map((entry) => ({
    value: entry.id,
    label: entry.phone ? `${entry.name} (${entry.phone})` : entry.name,
  }))

  const productOptions = products.map((entry) => ({
    value: entry.id,
    label: `${entry.name} (${entry.stock} in stock)`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/sales">
            <Button variant="ghost" className="mt-1">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create Sale</h1>
            <p className="text-sm text-slate-500">Build an invoice, adjust tax, and post it to stock and accounts.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={addRow}>
            <Plus size={16} />
            Add Item
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={loading}>
            <ReceiptText size={16} />
            Generate Invoice
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </Card>
      )}

      {submitError && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {submitError}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Select
                id="customer"
                label="Customer"
                value={customerId}
                onChange={(event) => handleCustomerChange(event.target.value)}
                options={customerOptions}
                placeholder={loading ? 'Loading customers...' : 'Select customer'}
                disabled={loading || !!loadError}
              />

              <Input
                id="paymentTermDays"
                label="Credit Days"
                type="number"
                min="0"
                value={paymentTermDays}
                onChange={(event) => setPaymentTermDays(event.target.value)}
              />

              <Input
                id="initialPaymentAmount"
                label="Initial Payment"
                type="number"
                min="0"
                step="0.01"
                value={initialPaymentAmount}
                onChange={(event) => setInitialPaymentAmount(event.target.value)}
              />

              <Select
                id="paymentMode"
                label="Payment Mode"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'BANK', label: 'Bank' },
                ]}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <Input
                id="notes"
                label="Internal Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes for this invoice"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-medium text-slate-600">Customer State</p>
                  <p className="mt-1 text-slate-900">{customer?.state || 'Not set'}</p>
                </div>
                <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-medium text-slate-600">Price Level</p>
                  <p className="mt-1 text-slate-900">{customer?.priceLevel || 'RETAIL'}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold text-right">Qty</th>
                    <th className="px-3 py-3 font-semibold text-right">Free</th>
                    <th className="px-3 py-3 font-semibold text-right">Rate</th>
                    <th className="px-3 py-3 font-semibold text-right">Disc %</th>
                    <th className="px-3 py-3 font-semibold text-right">GST</th>
                    <th className="px-3 py-3 font-semibold text-right">Line Total</th>
                    <th className="px-3 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const row = computedRows[index]
                    const product = row.product

                    return (
                      <tr key={`${index}-${item.productId || 'empty'}`} className="align-top">
                        <td className="px-4 py-3 min-w-[260px]">
                          <Select
                            value={item.productId}
                            onChange={(event) => updateRow(index, { productId: event.target.value })}
                            options={productOptions}
                            placeholder={loading ? 'Loading products...' : 'Select product'}
                            disabled={loading || !!loadError}
                          />
                          {product && (
                            <p className="mt-2 text-xs text-slate-500">
                              HSN: {product.hsnCode || 'NA'} | Stock: {product.stock}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 w-24">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => updateRow(index, { quantity: event.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3 w-24">
                          <Input
                            type="number"
                            min="0"
                            value={item.freeQty}
                            onChange={(event) => updateRow(index, { freeQty: event.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3 w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(event) => updateRow(index, { rate: event.target.value })}
                            placeholder={product ? String(product.price) : '0'}
                          />
                        </td>
                        <td className="px-3 py-3 w-24">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discountPct}
                            onChange={(event) => updateRow(index, { discountPct: event.target.value })}
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-600">
                          {product ? `${product.gstRate}%` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">
                          {row.totalAmount > 0 ? formatCurrency(row.totalAmount) : '-'}
                          {product && row.stockImpactQty > product.stock && (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              Exceeds stock
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className={cn(
                              'rounded-sm p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600',
                              items.length === 1 && 'opacity-50'
                            )}
                            disabled={items.length === 1}
                            aria-label={`Remove item ${index + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus size={14} />
                Add another line
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Invoice Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gross Amount</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-amber-700">
                  <span>Trade Discount</span>
                  <span>- {formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Taxable Amount</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.taxableAmount)}</span>
              </div>

              {/* Cash Discount */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 shrink-0">Cash Disc %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={cashDiscountPct}
                  onChange={e => setCashDiscountPct(e.target.value)}
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {parseNumber(cashDiscountPct) > 0 && (
                  <span className="ml-auto font-medium text-amber-700">
                    - {formatCurrency(totals.taxableAmount * parseNumber(cashDiscountPct) / 100)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">CGST</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.cgstAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">SGST</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.sgstAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">IGST</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.igstAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-slate-900">Invoice Total</span>
                <span className="font-bold text-indigo-600">{formatCurrency(totals.totalAmount)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Posting Preview</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Items to post: <span className="font-medium text-slate-900">{filteredRows.length}</span></p>
              <p>Stock deduction: <span className="font-medium text-slate-900">{filteredRows.reduce((sum, row) => sum + row.stockImpactQty, 0)}</span></p>
              <p>Initial receipt: <span className="font-medium text-slate-900">{formatCurrency(initialPaymentValue)}</span></p>
              <p>Outstanding after post: <span className="font-medium text-slate-900">{formatCurrency(Math.max(totals.totalAmount - initialPaymentValue, 0))}</span></p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

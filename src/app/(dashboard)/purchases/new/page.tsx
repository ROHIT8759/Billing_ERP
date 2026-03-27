'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, ArrowLeft, Truck, Keyboard, Info } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Supplier = { id: string; name: string; outstandingBalance: number }
type Product  = { id: string; name: string; price: number; stock: number }

type LineItem = {
  productId?: string
  productName: string
  quantity: number
  price: number
}

const EMPTY_ITEM = (): LineItem => ({
  productName: '', quantity: 1, price: 0
})

const SHORTCUTS = [
  { key: 'Tab', action: 'Next field' },
  { key: 'Ãƒâ€šÃ‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦Ãƒâ€šÃ‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ on last row', action: 'Add row' },
  { key: 'F9', action: 'Save Entry' },
  { key: 'F2', action: 'Focus Vendor' },
  { key: 'Del (empty row)', action: 'Remove row' },
]

export default function NewPurchasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHints, setShowHints] = useState(false)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [substituteSuggestions, setSubstituteSuggestions] = useState<Record<number, Product[]>>({})

  const [supplierId, setSupplierId] = useState('')
  const [vendorName, setVendorName] = useState('')
  
  const [items, setItems] = useState<LineItem[]>([EMPTY_ITEM()])

  // Keyboard Refs
  const gridRefs = useRef<(HTMLElement | null)[][]>([])
  const vendorRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([supData, prodData]) => {
      setSuppliers(supData.suppliers || [])
      setProducts(prodData || [])
    }).catch(() => setError('Failed to load initial data'))
  }, [])

  useEffect(() => {
    gridRefs.current = items.map((_, i) => gridRefs.current[i] || [null, null, null])
  }, [items.length])

  const setGridRef = useCallback((row: number, col: number, el: HTMLElement | null) => {
    if (!gridRefs.current[row]) {
      gridRefs.current[row] = [null, null, null]
    }
    gridRefs.current[row][col] = el
  }, [])

  // --- Keyboard navigation ---
  const NUM_COLS = 3 // product, qty, price

  const focusCell = useCallback((row: number, col: number) => {
    const el = gridRefs.current[row]?.[col]
    if (el) { el.focus(); (el as HTMLInputElement).select?.() }
  }, [])

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey && colIdx === NUM_COLS - 1)) {
      e.preventDefault()
      if (rowIdx === items.length - 1) {
        setItems(prev => {
          const next = [...prev, EMPTY_ITEM()]
          setTimeout(() => focusCell(next.length - 1, 0), 50)
          return next
        })
      } else {
        if (e.key === 'ArrowDown') focusCell(rowIdx + 1, colIdx)
        else focusCell(rowIdx + 1, 0)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx)
    } else if (e.key === 'Tab' && e.shiftKey && colIdx === 0) {
      e.preventDefault()
      if (rowIdx > 0) focusCell(rowIdx - 1, NUM_COLS - 1)
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (colIdx < NUM_COLS - 1) {
        e.preventDefault()
        focusCell(rowIdx, colIdx + 1)
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const item = items[rowIdx]
      if (!item.productName && items.length > 1) {
        e.preventDefault()
        removeItem(rowIdx)
        setTimeout(() => focusCell(Math.max(0, rowIdx - 1), 0), 50)
      }
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); vendorRef.current?.focus() }
      if (e.key === 'F9') { e.preventDefault(); document.getElementById('purchase-submit')?.click() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // --- Item Handlers ---
  const searchProductByName = (productName: string) => {
    return products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase()))
  }

  const handleProductNameChange = (index: number, val: string) => {
    setItems(prev => {
      const n = [...prev]
      n[index] = { ...n[index], productName: val }
      return n
    })
    
    if (val.length > 2) {
      setSubstituteSuggestions(prev => ({
        ...prev,
        [index]: searchProductByName(val)
      }))
    } else {
      setSubstituteSuggestions(prev => ({ ...prev, [index]: [] }))
    }
  }

  const handleProductSelect = (index: number, p: Product) => {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], productName: p.name, price: p.price, productId: p.id }
      return next
    })
    setSubstituteSuggestions(prev => ({ ...prev, [index]: [] }))
    
    // Auto-advance to QTY
    setTimeout(() => focusCell(index, 1), 50)
  }

  const handleItemChange = (index: number, field: keyof LineItem, val: string | number | undefined) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: val }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!vendorName) return setError('Please enter vendor name (F2)')
    if (items.some(i => !i.productName)) return setError('Please enter product names for all rows')
    if (items.length === 0) return setError('Please add at least one product')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId || null,
          vendorName,
          items: items.map(i => ({ productName: i.productName, quantity: i.quantity, price: i.price })),
          totalAmount: calculatedTotal
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to record purchase')
      }

      router.push('/purchases')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record purchase')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-24 h-[calc(100vh-2rem)] flex flex-col">
      {/* Header Strip */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Fast Purchase Entry</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHints(!showHints)}
            className={cn("text-xs font-medium", showHints ? "bg-amber-100 text-amber-700" : "text-slate-500")}
          >
            <Keyboard size={14} className="mr-1.5" /> F1 Shortcuts
          </Button>
          <Button id="purchase-submit" size="sm" onClick={() => handleSubmit()} loading={loading} className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500">
            Save (F9)
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm font-medium text-red-700 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2 flex-shrink-0">
          <Info size={16} /> {error}
        </div>
      )}

      {showHints && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 flex-shrink-0">
          {SHORTCUTS.map(sc => (
            <div key={sc.key} className="flex flex-col p-2 bg-slate-900 rounded border border-slate-700 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-400">{sc.key}</span>
              <span className="text-xs text-slate-300 truncate">{sc.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* Marg-style compact upper form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="md:col-span-2 relative">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1 block">Account / Supplier (F2)</label>
          <select
            ref={vendorRef}
            value={supplierId}
            onChange={(e) => {
              const value = e.target.value
              setSupplierId(value)
              const selectedSupplier = suppliers.find((supplier) => supplier.id === value)
              if (selectedSupplier) {
                setVendorName(selectedSupplier.name)
              }
            }}
            className="w-full h-8 text-sm border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 px-2 py-0 bg-white shadow-sm font-medium"
          >
            <option value="">-- Create new vendor below --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} | Bal: {formatCurrency(s.outstandingBalance)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1 block">Vendor Name (Manual)</label>
          <input
            value={vendorName}
            onChange={(e) => {
              setVendorName(e.target.value)
              if (supplierId && suppliers.find(s => s.id === supplierId)?.name !== e.target.value) {
                setSupplierId('')
              }
            }}
            placeholder="Type vendor name explicitly..."
            className="w-full h-8 text-sm border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 px-2 shadow-sm uppercase font-semibold text-amber-900"
          />
        </div>
      </div>

      {/* Grid Container */}
      <Card className="flex-1 flex flex-col p-0 overflow-hidden border-slate-300 shadow-xl shadow-slate-200/50 min-h-[300px]">
        {/* Header Row */}
        <div className="grid grid-cols-12 gap-0 border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-700 uppercase tracking-widest flex-shrink-0">
          <div className="col-span-1 p-2 border-r border-slate-300 text-center">S.N.</div>
          <div className="col-span-6 p-2 border-r border-slate-300">Product Name</div>
          <div className="col-span-2 p-2 border-r border-slate-300 text-right">Qty</div>
          <div className="col-span-2 p-2 border-r border-slate-300 text-right">Rate</div>
          <div className="col-span-1 p-2 text-right">Amount</div>
        </div>

        {/* Scrollable rows */}
        <div className="flex-1 overflow-y-auto bg-white">
          {items.map((item, idx) => (
            <div key={idx} className="group grid grid-cols-12 gap-0 border-b border-slate-100 focus-within:bg-amber-50/50 hover:bg-slate-50 relative">
              <div className="col-span-1 p-1 border-r border-slate-200 text-xs text-slate-400 flex items-center justify-center font-mono select-none">
                {idx + 1}
              </div>
              
              <div className="col-span-6 border-r border-slate-200 relative">
                <input
                  ref={el => setGridRef(idx, 0, el)}
                  value={item.productName}
                  onChange={(e) => handleProductNameChange(idx, e.target.value)}
                  onKeyDown={e => handleCellKeyDown(e, idx, 0)}
                  placeholder="Enter product..."
                  className="w-full h-8 px-2 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 focus:z-10 relative"
                />
                
                {/* Autocomplete Dropdown */}
                {substituteSuggestions[idx]?.length > 0 && (
                  <div className="absolute z-50 left-0 top-full mt-1 w-[400px] bg-white rounded shadow-2xl border border-slate-800 py-1 overflow-hidden">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
                      Existing Catalog Matches
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                      {substituteSuggestions[idx].map(sug => (
                        <li 
                          key={sug.id} 
                          className="px-3 py-1.5 text-sm hover:bg-amber-600 hover:text-white cursor-pointer flex justify-between group/item"
                          onClick={() => handleProductSelect(idx, sug)}
                        >
                          <span className="font-semibold">{sug.name}</span>
                          <span className="font-mono text-xs opacity-60 group-hover/item:text-amber-100 pr-2">
                            Stock: {sug.stock}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="col-span-2 border-r border-slate-200 bg-slate-50/30">
                <input
                  ref={el => setGridRef(idx, 1, el)}
                  type="number"
                  min="1"
                  value={item.quantity || ''}
                  onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10))}
                  onKeyDown={e => handleCellKeyDown(e, idx, 1)}
                  className="w-full h-8 px-2 text-sm text-right font-mono bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 focus:z-10 relative"
                />
              </div>
              
              <div className="col-span-2 border-r border-slate-200">
                <input
                  ref={el => setGridRef(idx, 2, el)}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price || ''}
                  onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value))}
                  onKeyDown={e => handleCellKeyDown(e, idx, 2)}
                  className="w-full h-8 px-2 text-sm text-right font-mono bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 focus:z-10 relative"
                />
              </div>
              
              <div className="col-span-1 p-1 flex items-center justify-end px-2 text-sm font-mono font-bold text-slate-700 bg-slate-50/50 group-focus-within:bg-amber-100/30">
                {formatCurrency(item.quantity * item.price)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals Strip */}
        <div className="bg-slate-900 border-t border-slate-800 text-white p-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-6 px-2">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mr-2">Rows</span>
              <span className="font-mono font-bold text-amber-400">{items.length}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mr-2">Total Qty</span>
              <span className="font-mono font-bold text-amber-400">{items.reduce((s,i)=>s+(i.quantity||0),0)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-black/40 rounded px-4 py-1 border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">Grand Total</span>
            <span className="text-xl font-mono font-black text-white">{formatCurrency(calculatedTotal)}</span>
          </div>
        </div>
      </Card>
      
      <p className="text-center text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-widest">
        Pro Tip: Try pressing TAB at the end of the last row to instantly create a new line.
      </p>
    </div>
  )
}

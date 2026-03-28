'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scan, Save, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Supplier = { id: string; name: string }
type Product  = { id: string; name: string; price: number; stock: number }

type LineItem = {
  productId:   string
  productName: string
  pack:        string
  batchNo:     string
  quantity:    string
  freeQty:     string
  price:       string
  discountPct: string
  amount:      number
}

const EMPTY_ITEM = (): LineItem => ({
  productId: '', productName: '', pack: '', batchNo: '',
  quantity: '', freeQty: '', price: '', discountPct: '', amount: 0,
})

function calcAmount(qty: string, price: string, disc: string) {
  const q = parseFloat(qty)   || 0
  const p = parseFloat(price) || 0
  const d = parseFloat(disc)  || 0
  const gross = q * p
  return gross - gross * d / 100
}

const GRID_CLS = "w-full h-full px-1 text-[13px] font-bold outline-none bg-transparent focus:bg-[#000080] focus:text-white caret-white"
const LABEL    = "text-[#03437e] text-[13px] font-medium min-w-[60px] shrink-0"
const VAL_CLS  = "text-black text-[13px] font-bold border-none outline-none bg-transparent focus:bg-[#000080] focus:text-white px-1"
const NUM_COLS = 7

export default function NewPurchasePage() {
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products,  setProducts]  = useState<Product[]>([])

  const [supplierId, setSupplierId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [billNo,     setBillNo]     = useState('')
  const [creditDays, setCreditDays] = useState('0')
  const [initialPay, setInitialPay] = useState('0')
  const [payMode,    setPayMode]    = useState<'CASH'|'BANK'>('CASH')

  const [items,  setItems]  = useState<LineItem[]>(Array(12).fill(null).map(EMPTY_ITEM))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const gridRefs = useRef<(HTMLElement | null)[][]>([])

  const today = new Date()
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-')

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then(r => r.json()).catch(() => ({ suppliers: [] })),
      fetch('/api/products').then(r => r.json()).catch(() => []),
    ]).then(([supData, prodData]) => {
      setSuppliers(supData.suppliers || [])
      setProducts(prodData || [])
    })
  }, [])

  useEffect(() => {
    gridRefs.current = items.map((_, i) => gridRefs.current[i] || Array(NUM_COLS).fill(null))
  }, [items.length])

  const focusCell = useCallback((row: number, col: number) => {
    const el = gridRefs.current[row]?.[col]
    if (el) { el.focus(); (el as HTMLInputElement).select?.() }
  }, [])

  const handleCellKey = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' && !e.shiftKey && colIdx === NUM_COLS - 1) {
      e.preventDefault()
      if (rowIdx === items.length - 1) {
        setItems(prev => {
          const next = [...prev, EMPTY_ITEM()]
          setTimeout(() => focusCell(next.length - 1, 0), 30)
          return next
        })
      } else focusCell(rowIdx + 1, 0)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowIdx < items.length - 1) focusCell(rowIdx + 1, colIdx)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx)
    } else if (e.key === 'Tab' && e.shiftKey && colIdx === 0) {
      e.preventDefault()
      if (rowIdx > 0) focusCell(rowIdx - 1, NUM_COLS - 1)
    } else if (e.key === 'Tab' && !e.shiftKey && colIdx < NUM_COLS - 1) {
      e.preventDefault()
      focusCell(rowIdx, colIdx + 1)
    }
  }

  const handleProductSelect = (rowIdx: number, productId: string) => {
    const p = products.find(x => x.id === productId)
    setItems(prev => {
      const next = [...prev]
      const row  = next[rowIdx]
      next[rowIdx] = {
        ...row,
        productId:   p?.id   || '',
        productName: p?.name || '',
        price:       p ? String(p.price) : row.price,
        amount:      calcAmount(row.quantity, p ? String(p.price) : row.price, row.discountPct),
      }
      return next
    })
    setTimeout(() => focusCell(rowIdx, 1), 30)
  }

  const updateItem = (rowIdx: number, field: keyof LineItem, val: string) => {
    setItems(prev => {
      const next = [...prev]
      const row  = { ...next[rowIdx], [field]: val }
      if (['quantity', 'price', 'discountPct'].includes(field)) {
        row.amount = calcAmount(
          field === 'quantity'    ? val : row.quantity,
          field === 'price'       ? val : row.price,
          field === 'discountPct' ? val : row.discountPct,
        )
      }
      next[rowIdx] = row
      return next
    })
  }

  const filledItems = items.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
  const totalAmount = filledItems.reduce((s, i) => s + i.amount, 0)
  const totalQty    = filledItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)

  const handleSupplierChange = (id: string) => {
    setSupplierId(id)
    const s = suppliers.find(x => x.id === id)
    setVendorName(s?.name || '')
  }

  const handleSave = useCallback(async () => {
    setError('')
    if (!supplierId && !vendorName.trim()) {
      setError('Select or enter a supplier / vendor name')
      return
    }
    if (filledItems.length === 0) {
      setError('Add at least one item with quantity')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId:           supplierId || undefined,
          vendorName:           vendorName.trim() || undefined,
          billNo:               billNo.trim() || undefined,
          paymentTermDays:      parseInt(creditDays, 10) || 0,
          initialPaymentAmount: parseFloat(initialPay) || 0,
          paymentMode:          payMode,
          totalAmount,
          items: filledItems.map(i => ({
            productId:   i.productId   || undefined,
            productName: i.productName,
            pack:        i.pack        || undefined,
            batchNo:     i.batchNo     || undefined,
            quantity:    parseFloat(i.quantity),
            freeQty:     parseFloat(i.freeQty) || 0,
            price:       parseFloat(i.price),
            discountPct: parseFloat(i.discountPct) || 0,
            amount:      i.amount,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save purchase')
      router.push(`/purchases/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }, [supplierId, vendorName, billNo, creditDays, initialPay, payMode, totalAmount, filledItems, router])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'F9')  { e.preventDefault(); handleSave() }
      if (e.key === 'F11') { e.preventDefault(); router.push('/purchases/scan') }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [handleSave, router])

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans overflow-hidden"
         style={{ zoom: '0.95', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      <div className="flex-1 flex flex-col bg-[#f0f9ff] border-2 border-slate-400 w-full min-h-screen shadow-lg">

        {/* Top ribbon */}
        <div className="bg-[#5e8082] text-white flex justify-between items-center px-2 py-0.5 border-b border-slate-300">
          <div className="flex items-center gap-3">
            <Link href="/purchases">
              <button type="button" className="p-1 hover:bg-white/10 rounded transition-colors">
                <ArrowLeft size={16} />
              </button>
            </Link>
            <span className="font-bold text-[14px]">PURCHASE ENTRY</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/purchases/scan">
              <button type="button"
                className="px-2 py-0.5 bg-teal-600 hover:bg-teal-500 border border-teal-400 rounded text-[12px] font-bold flex items-center gap-1.5 transition-colors">
                <Scan className="w-3.5 h-3.5" /> F11 – SCAN
              </button>
            </Link>
            <span className="font-mono text-[12px] font-bold">{today}</span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-100 border-b border-red-400 text-red-700 px-4 py-1.5 text-[13px] font-bold">
            ⚠ {error}
          </div>
        )}

        {/* Sub-header */}
        <div className="p-1.5 pb-2 border-b-2 border-slate-400 space-y-1.5 bg-[#f0f9ff]">
          <div className="flex flex-wrap gap-x-6 gap-y-1 items-center">
            {/* Supplier */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Supplier</span>
              <span className="text-[#03437e] font-bold">:</span>
              <select
                value={supplierId}
                onChange={e => handleSupplierChange(e.target.value)}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[13px] font-bold text-black focus:outline-none focus:ring-1 focus:ring-[#000080] min-w-[180px]"
              >
                <option value="">— Select supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Vendor name */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
              <span className={LABEL}>Name</span>
              <span className="text-[#03437e] font-bold">:</span>
              <input
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="or type vendor name"
                className={cn(VAL_CLS, "flex-1 border-b border-slate-300 uppercase")}
              />
            </div>
            {/* Bill no */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Bill No</span>
              <span className="text-[#03437e] font-bold">:</span>
              <input
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                className={cn(VAL_CLS, "w-28 border-b border-slate-300")}
                placeholder="INV-001"
              />
            </div>
            {/* Date */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Date</span>
              <span className="text-[#03437e] font-bold">:</span>
              <span className="text-[13px] font-bold text-black">{today}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 items-center">
            {/* Credit days */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Credit</span>
              <span className="text-[#03437e] font-bold">:</span>
              <input type="number" min="0" value={creditDays} onChange={e => setCreditDays(e.target.value)}
                className={cn(VAL_CLS, "w-14 text-right border-b border-slate-300")} />
              <span className="text-[11px] text-slate-500 ml-0.5">days</span>
            </div>
            {/* Pay now */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Pay Now</span>
              <span className="text-[#03437e] font-bold">:</span>
              <input type="number" min="0" step="0.01" value={initialPay} onChange={e => setInitialPay(e.target.value)}
                className={cn(VAL_CLS, "w-24 text-right border-b border-slate-300")} />
            </div>
            {/* Mode */}
            <div className="flex items-center gap-1.5">
              <span className={LABEL}>Mode</span>
              <span className="text-[#03437e] font-bold">:</span>
              <select value={payMode} onChange={e => setPayMode(e.target.value as 'CASH'|'BANK')}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[13px] font-bold text-black focus:outline-none focus:ring-1 focus:ring-[#000080]">
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div className="text-center text-[10px] text-[#000080] font-bold py-0.5 border-b border-slate-400 bg-[#f0f9ff]">
          Tab/↓ = next cell &nbsp;|&nbsp; F9 = Save &nbsp;|&nbsp; F11 = Scan Invoice
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#e2e9cb] border-b-2 border-slate-400">
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[12px] font-bold text-[#445b4c] w-[28%]">PRODUCT</th>
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[12px] font-bold text-[#445b4c] w-[7%]">PACK</th>
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[12px] font-bold text-[#445b4c] w-[11%]">BATCH</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[12px] font-bold text-[#445b4c] w-[7%]">QTY</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[12px] font-bold text-[#445b4c] w-[7%]">FREE</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[12px] font-bold text-[#445b4c] w-[10%]">P.RATE</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[12px] font-bold text-[#445b4c] w-[8%]">DIS%</th>
                <th className="py-1 px-1 text-right text-[12px] font-bold text-[#445b4c] w-[12%]">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={cn("border-b border-slate-200 h-6", item.productId ? "bg-white" : "bg-white")}>

                  {/* Col 0 — Product */}
                  <td className="border-r border-slate-400 p-0">
                    <select
                      ref={el => {
                        if (!gridRefs.current[idx]) gridRefs.current[idx] = Array(NUM_COLS).fill(null)
                        gridRefs.current[idx][0] = el
                      }}
                      value={item.productId}
                      onChange={e => handleProductSelect(idx, e.target.value)}
                      onKeyDown={e => handleCellKey(e, idx, 0)}
                      className={cn(GRID_CLS, "cursor-pointer")}
                    >
                      <option value="">—</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (×{p.stock})</option>
                      ))}
                    </select>
                  </td>

                  {/* Col 1 — Pack */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][1] = el }}
                      className={GRID_CLS} value={item.pack}
                      onChange={e => updateItem(idx, 'pack', e.target.value)}
                      onKeyDown={e => handleCellKey(e, idx, 1)}
                    />
                  </td>

                  {/* Col 2 — Batch */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][2] = el }}
                      className={GRID_CLS} value={item.batchNo}
                      onChange={e => updateItem(idx, 'batchNo', e.target.value)}
                      onKeyDown={e => handleCellKey(e, idx, 2)}
                    />
                  </td>

                  {/* Col 3 — Qty */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][3] = el }}
                      className={cn(GRID_CLS, "text-right")} value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={e => handleCellKey(e, idx, 3)}
                    />
                  </td>

                  {/* Col 4 — Free */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][4] = el }}
                      className={cn(GRID_CLS, "text-right")} value={item.freeQty}
                      onChange={e => updateItem(idx, 'freeQty', e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={e => handleCellKey(e, idx, 4)}
                    />
                  </td>

                  {/* Col 5 — P.Rate */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][5] = el }}
                      className={cn(GRID_CLS, "text-right")} value={item.price}
                      onChange={e => updateItem(idx, 'price', e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={e => handleCellKey(e, idx, 5)}
                    />
                  </td>

                  {/* Col 6 — Disc% */}
                  <td className="border-r border-slate-400 p-0">
                    <input
                      ref={el => { if (gridRefs.current[idx]) gridRefs.current[idx][6] = el }}
                      className={cn(GRID_CLS, "text-right")} value={item.discountPct}
                      onChange={e => updateItem(idx, 'discountPct', e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={e => handleCellKey(e, idx, 6)}
                    />
                  </td>

                  {/* Amount read-only */}
                  <td className="p-0 pr-1 text-right text-[13px] font-bold text-black bg-[#fafafa]">
                    {item.amount > 0 ? item.amount.toFixed(2) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-[#f0f9ff] border-t-2 border-slate-500 grid grid-cols-[1fr_220px_260px] text-[13px]">
          <div className="border-r border-slate-400 p-2 font-mono text-[12px] space-y-0.5">
            <div className="flex gap-2">
              <span className="text-[#03437e]">Items :</span>
              <span className="font-bold text-green-700">{filledItems.length}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#03437e]">Total Qty :</span>
              <span className="font-bold">{totalQty.toFixed(0)}</span>
            </div>
            {vendorName && (
              <div className="flex gap-2 max-w-xs truncate">
                <span className="text-[#03437e] shrink-0">Vendor :</span>
                <span className="font-bold uppercase truncate">{vendorName}</span>
              </div>
            )}
          </div>

          <div className="border-r border-slate-400 p-2 font-mono text-[12px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[#03437e]">Gross Amt :</span>
              <span className="font-bold">{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#03437e]">Pay Now  :</span>
              <span className="font-bold text-green-700">{(parseFloat(initialPay)||0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#03437e]">Balance  :</span>
              <span className="font-bold text-red-700">{Math.max(totalAmount - (parseFloat(initialPay)||0), 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="p-2 font-mono text-[12px] space-y-0.5 bg-[#f0f9ff]">
            <div className="flex justify-between font-bold text-[#03437e]">
              <span>TOTAL AMOUNT :</span>
              <span className="text-black text-[15px]">{totalAmount > 0 ? totalAmount.toFixed(2) : ''}</span>
            </div>
            <div className="flex justify-between text-[#03437e]">
              <span>Credit Days  :</span>
              <span>{creditDays || '0'}</span>
            </div>
            <div className="flex justify-between text-[#03437e]">
              <span>Mode         :</span>
              <span>{payMode}</span>
            </div>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="bg-[#5e8082] text-white flex items-center justify-between text-[11px] font-bold border-t border-slate-700">
          <div className="flex items-center">
            <Link href="/purchases">
              <span className="bg-red-600 px-2 py-0.5 border border-red-800 cursor-pointer hover:bg-red-700 transition-colors">ESC</span>
            </Link>
            <div className="flex border-l border-[#425f54] mx-2 uppercase tracking-wide">
              {['SALE','PURC','SC','PC','COPY','PASTE','SR','PR','O/S','BE','CASH','VOU','HOLD'].map(btn => (
                <span key={btn} className="px-1.5 py-0.5 border-r border-[#8aa6a7] cursor-default hover:bg-slate-500 transition-colors">{btn}</span>
              ))}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "px-3 py-0.5 font-bold border-r border-[#8aa6a7] flex items-center gap-1 transition-colors",
                  saving
                    ? "bg-slate-500 cursor-not-allowed opacity-70"
                    : "bg-[#4a0d14] text-[#ffb8c6] hover:bg-red-900 cursor-pointer"
                )}
              >
                <Save size={12} />
                {saving ? 'SAVING…' : 'F9–SAVE'}
              </button>
            </div>
          </div>
          <div className="px-2 text-[10px] text-white/70">
            {filledItems.length} items · ₹{totalAmount.toFixed(2)}
          </div>
        </div>

      </div>
    </div>
  )
}

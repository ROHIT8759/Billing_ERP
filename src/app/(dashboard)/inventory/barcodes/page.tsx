'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Search, Barcode, Printer, Edit2, RefreshCw, Copy } from 'lucide-react'

type Product = {
  id: string
  name: string
  category: string | null
  price: number
  barcode: string | null
}

function BarcodeDisplay({ value, height = 50 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current || !value) return
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          height,
          fontSize: 11,
          margin: 4,
          lineColor: '#1e293b',
          background: 'transparent',
        })
        setError(false)
      } catch {
        setError(true)
      }
    })
  }, [value, height])

  if (error) return <span className="text-xs text-red-500">Invalid barcode</span>
  return <svg ref={ref} />
}

function generateBarcode(id: string) {
  // 12-char alphanumeric from product ID (strip hyphens, uppercase, take first 12)
  return id.replace(/-/g, '').toUpperCase().slice(0, 12)
}

export default function BarcodesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products')
    if (res.ok) setProducts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setBarcodeInput(p.barcode || generateBarcode(p.id))
    setIsEditOpen(true)
  }

  const saveBarcode = async () => {
    if (!editingProduct) return
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: barcodeInput.trim() || null })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchProducts()
      setIsEditOpen(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const autoGenerateAll = async () => {
    const toUpdate = products.filter((p) => !p.barcode)
    if (toUpdate.length === 0) { alert('All products already have barcodes.'); return }
    for (const p of toUpdate) {
      await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: generateBarcode(p.id) })
      })
    }
    await fetchProducts()
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handlePrint = () => {
    const printProducts = products.filter((p) => selected.size === 0 ? p.barcode : selected.has(p.id) && p.barcode)
    if (printProducts.length === 0) { alert('No products with barcodes selected.'); return }

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Barcode Labels</title>
      <style>
        body { font-family: sans-serif; margin: 0; padding: 16px; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .label { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; text-align: center; width: 160px; }
        .name { font-size: 11px; font-weight: 600; color: #0f172a; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .price { font-size: 10px; color: #475569; margin-bottom: 4px; }
        .barcode-val { font-size: 9px; font-family: monospace; color: #64748b; }
        @media print { @page { margin: 10mm; } }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      </head><body>
      <div class="grid">
        ${printProducts.map((p) => `
          <div class="label">
            <div class="name">${p.name}</div>
            <div class="price">₹${p.price.toFixed(2)}</div>
            <svg id="bc-${p.id}"></svg>
            <div class="barcode-val">${p.barcode}</div>
          </div>
        `).join('')}
      </div>
      <script>
        window.onload = function() {
          ${printProducts.map((p) => `
            try { JsBarcode('#bc-${p.id}', '${p.barcode}', { format: 'CODE128', height: 40, fontSize: 9, margin: 2 }) } catch(e) {}
          `).join('\n')}
          setTimeout(() => window.print(), 500)
        }
      </script>
      </body></html>
    `)
    win.document.close()
  }

  const copyBarcode = (val: string) => {
    navigator.clipboard.writeText(val).catch(() => {})
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  )

  const withBarcode = products.filter((p) => p.barcode).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Barcode Management</h1>
          <p className="text-slate-500 text-sm">{withBarcode}/{products.length} products have barcodes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoGenerateAll}>
            <RefreshCw size={16} />
            Auto-Generate All
          </Button>
          <Button onClick={handlePrint}>
            <Printer size={16} />
            Print Labels {selected.size > 0 && `(${selected.size})`}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search products or barcodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
            />
          </div>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700">
              Clear selection ({selected.size})
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="px-4 py-4 w-8">
                    <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} checked={selected.size === filtered.length && filtered.length > 0} className="rounded" />
                  </th>
                  <th className="px-4 py-4 font-medium">Product</th>
                  <th className="px-6 py-4 font-medium">Barcode Value</th>
                  <th className="px-6 py-4 font-medium">Preview</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${selected.has(p.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.category && <div className="text-xs text-slate-500">{p.category}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {p.barcode ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{p.barcode}</code>
                          <button onClick={() => copyBarcode(p.barcode!)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Copy">
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <Badge variant="default">Not set</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {p.barcode ? (
                        <BarcodeDisplay value={p.barcode} height={36} />
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit barcode">
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isEditOpen} onClose={() => !saving && setIsEditOpen(false)} title="Set Barcode">
        {editingProduct && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Product: <strong>{editingProduct.name}</strong></p>
            <Input
              label="Barcode Value (CODE128)"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="e.g. 123456789012"
            />
            {barcodeInput && (
              <div className="border border-slate-200 rounded-xl p-4 flex justify-center bg-white">
                <BarcodeDisplay value={barcodeInput} height={60} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBarcodeInput(generateBarcode(editingProduct.id))}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Barcode size={13} className="inline mr-1" />
                Auto-generate
              </button>
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={saveBarcode} loading={saving}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

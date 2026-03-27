'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, PackageSearch } from 'lucide-react'

type Supplier = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  category: string | null
  price: number
  stock: number
  hsnCode: string | null
  gstRate: number
  mrp: number | null
  retailRate: number | null
  wholesaleRate: number | null
  distributorRate: number | null
  saltComposition: string | null
  minStockLevel: number | null
  reorderLevel: number | null
  maxStockLevel: number | null
  reorderQuantity: number | null
  primarySupplierId: string | null
  barcode: string | null
  createdAt: string
  primarySupplier?: { id: string; name: string } | null
}

const EMPTY_FORM = {
  name: '',
  category: '',
  price: '',
  stock: '0',
  hsnCode: '',
  gstRate: '18',
  mrp: '',
  retailRate: '',
  wholesaleRate: '',
  distributorRate: '',
  saltComposition: '',
  minStockLevel: '',
  reorderLevel: '',
  maxStockLevel: '',
  reorderQuantity: '',
  primarySupplierId: '',
  barcode: '',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      setProducts(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    const res = await fetch('/api/suppliers')
    if (!res.ok) return
    const data = await res.json()
    setSuppliers(data.suppliers || [])
  }

  useEffect(() => {
    fetchProducts()
    fetchSuppliers()
  }, [])

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id)
      setFormData({
        name: product.name,
        category: product.category || '',
        price: String(product.price),
        stock: String(product.stock),
        hsnCode: product.hsnCode || '',
        gstRate: String(product.gstRate || 18),
        mrp: product.mrp?.toString() || '',
        retailRate: product.retailRate?.toString() || '',
        wholesaleRate: product.wholesaleRate?.toString() || '',
        distributorRate: product.distributorRate?.toString() || '',
        saltComposition: product.saltComposition || '',
        minStockLevel: product.minStockLevel?.toString() || '',
        reorderLevel: product.reorderLevel?.toString() || '',
        maxStockLevel: product.maxStockLevel?.toString() || '',
        reorderQuantity: product.reorderQuantity?.toString() || '',
        primarySupplierId: product.primarySupplierId || '',
        barcode: product.barcode || '',
      })
    } else {
      setEditingId(null)
      setFormData(EMPTY_FORM)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const url = editingId ? `/api/products/${editingId}` : '/api/products'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save product')
      }

      await fetchProducts()
      setIsModalOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete product')
      await fetchProducts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  const filteredProducts = products.filter((product) => {
    const term = search.toLowerCase()
    return (
      product.name.toLowerCase().includes(term) ||
      product.category?.toLowerCase().includes(term) ||
      product.saltComposition?.toLowerCase().includes(term) ||
      product.primarySupplier?.name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">Manage inventory, salt composition, supplier linkage, and stock control bands</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
          <Plus size={18} />
          Add Product
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by product, category, salt, or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading products...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <PackageSearch size={32} />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">No products found</h3>
            <p className="max-w-sm text-sm text-slate-500">{search ? 'Try a different search term.' : 'Add your first product to start tracking inventory.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Salt / Composition</th>
                  <th className="px-3 py-2 font-semibold">Supplier</th>
                  <th className="px-3 py-2 font-semibold text-right">Price</th>
                  <th className="px-3 py-2 font-semibold text-right">Stock</th>
                  <th className="px-3 py-2 font-semibold text-right">Bands</th>
                  <th className="px-3 py-2 font-semibold">Added On</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const isBelowReorder = product.reorderLevel != null && product.stock <= product.reorderLevel
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-3 py-2 border-r border-slate-50">
                        <div className="font-semibold text-slate-900">{product.name}</div>
                        <div className="text-[10px] text-slate-500">{product.category || 'Uncategorized'}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 border-r border-slate-50">{product.saltComposition || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 border-r border-slate-50">{product.primarySupplier?.name || '-'}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 border-r border-slate-50">{formatCurrency(product.price)}</td>
                      <td className="px-3 py-2 text-right border-r border-slate-50">
                        <Badge variant={isBelowReorder ? 'danger' : product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'danger'}>
                          {product.stock} units
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] text-slate-500 border-r border-slate-50">
                        <div>Min: {product.minStockLevel ?? '-'}</div>
                        <div>Reorder: {product.reorderLevel ?? '-'}</div>
                        <div>Max: {product.maxStockLevel ?? '-'}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-500 border-r border-slate-50">{formatDate(product.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(product)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => !formLoading && setIsModalOpen(false)} title={editingId ? 'Edit Product' : 'Add New Product'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Product Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            <Input label="Salt / Composition" value={formData.saltComposition} onChange={(e) => setFormData({ ...formData, saltComposition: e.target.value })} placeholder="e.g. Paracetamol 650mg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price (Rs) *" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
            <Input label="Initial Stock *" type="number" min="0" step="1" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="HSN / SAC Code" value={formData.hsnCode} onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })} />
            <Input label="GST Rate (%)" type="number" min="0" max="28" step="1" value={formData.gstRate} onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="MRP" type="number" min="0" step="0.01" value={formData.mrp} onChange={(e) => setFormData({ ...formData, mrp: e.target.value })} />
            <Input label="Retail Rate" type="number" min="0" step="0.01" value={formData.retailRate} onChange={(e) => setFormData({ ...formData, retailRate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Wholesale Rate" type="number" min="0" step="0.01" value={formData.wholesaleRate} onChange={(e) => setFormData({ ...formData, wholesaleRate: e.target.value })} />
            <Input label="Distributor Rate" type="number" min="0" step="0.01" value={formData.distributorRate} onChange={(e) => setFormData({ ...formData, distributorRate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Minimum Level" type="number" min="0" step="1" value={formData.minStockLevel} onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })} />
            <Input label="Reorder Level" type="number" min="0" step="1" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Maximum Level" type="number" min="0" step="1" value={formData.maxStockLevel} onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })} />
            <Input label="Reorder Quantity" type="number" min="0" step="1" value={formData.reorderQuantity} onChange={(e) => setFormData({ ...formData, reorderQuantity: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Supplier</label>
              <select value={formData.primarySupplierId} onChange={(e) => setFormData({ ...formData, primarySupplierId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                <option value="">No supplier linked</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </div>
            <Input label="Barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button type="submit" loading={formLoading}>{editingId ? 'Save Changes' : 'Add Product'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

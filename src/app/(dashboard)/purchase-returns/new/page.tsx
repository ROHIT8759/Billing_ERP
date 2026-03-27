'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { ArchiveRestore, Search, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NewPurchaseReturnPage() {
  const router = useRouter()
  
  // Step 1: Search Purchase Bill
  const [searchTerm, setSearchTerm] = useState('')
  const [purchases, setPurchases] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  
  // Step 2: Selected Purchase & Return Data
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null)
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [reason, setReason] = useState('')
  
  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchPurchases = async () => {
    if (!searchTerm.trim()) return
    setSearching(true)
    setError('')
    try {
      const res = await fetch('/api/purchases')
      const data = await res.json()
      const matches = data.filter((p: any) => 
        (p.billNo && p.billNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.supplier?.name && p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setPurchases(matches)
    } catch (err: any) {
      setError('Failed to search purchases')
    } finally {
      setSearching(false)
    }
  }

  const selectPurchase = (purchase: any) => {
    setSelectedPurchase(purchase)
    setReturnItems(purchase.items.map((item: any) => ({
      ...item,
      returnQty: 0
    })))
  }

  const updateReturnQty = (index: number, qty: string) => {
    const parsed = parseInt(qty, 10) || 0
    const item = returnItems[index]
    const validQty = Math.max(0, Math.min(parsed, item.quantity))

    const newItems = [...returnItems]
    newItems[index].returnQty = validQty
    setReturnItems(newItems)
  }

  const calculatedTotal = returnItems.reduce((sum, item) => sum + (item.returnQty * item.price), 0)

  const handleSubmit = async () => {
    if (calculatedTotal <= 0) {
      setError('You must return at least one item to generate a debit note.')
      return
    }

    setSubmitting(true)
    setError('')
    
    try {
      // Find exact product IDs by matching names (Simplified approach for now, assuming productName matches product.name)
      // Ideally, purchase items should strictly attach productId if it's linked. If not, we skip the product adjustment.
      const payload = {
        purchaseId: selectedPurchase.id,
        reason,
        totalAmount: calculatedTotal,
        items: returnItems
          .filter(item => item.returnQty > 0)
          .map(item => ({
            purchaseItemId: item.id,
            productId: item.productId || item.product?.id || 'NO_ID', // Requires backend matching if isolated
            quantity: item.returnQty,
            rate: item.price,
            amount: item.returnQty * item.price
          }))
      }

      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate debit note')
      }

      router.push('/purchase-returns')
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/purchase-returns" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArchiveRestore size={24} className="text-amber-600" /> New Debit Note
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select a purchase bill and specify items returning to supplier</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}

      {!selectedPurchase ? (
        <Card className="p-6">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <Search size={48} className="mx-auto text-slate-200 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800">Find Supplier Bill</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6">Enter the purchase bill number or supplier name.</p>
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="e.g. BILL-9912 or Supplier Corp" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPurchases()}
              />
              <Button onClick={searchPurchases} loading={searching} className="bg-amber-600 hover:bg-amber-700">Search</Button>
            </div>

            {purchases.length > 0 && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {purchases.map(p => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{p.billNo || `Purchase ${p.id.split('-')[0]}`}</p>
                      <p className="text-sm text-slate-500">{p.supplier?.name || p.vendorName} • {formatCurrency(p.totalAmount)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => selectPurchase(p)}>Select</Button>
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
                  <h3 className="font-bold text-slate-800">Original Bill: {selectedPurchase.billNo || selectedPurchase.id.split('-')[0]}</h3>
                  <p className="text-sm text-slate-500">Supplier: {selectedPurchase.supplier?.name || selectedPurchase.vendorName}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPurchase(null)}>Change Bill</Button>
              </div>

              <div className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3 text-right">Bought Qty</th>
                      <th className="px-4 py-3 text-right">Purchase Rate</th>
                      <th className="px-4 py-3 text-center">Return Qty</th>
                      <th className="px-4 py-3 text-right">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {returnItems.map((item, idx) => (
                      <tr key={item.id} className={item.returnQty > 0 ? 'bg-amber-50/30' : ''}>
                        <td className="px-4 py-3 font-medium">{item.productName}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-center w-32">
                          <input 
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={item.returnQty || ''}
                            onChange={(e) => updateReturnQty(idx, e.target.value)}
                            className="w-20 px-2 py-1 text-center border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
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
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -z-10 opacity-50"></div>
              
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-amber-600"/> Debit Note Summary
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Items Returning</span>
                  <span className="font-medium">{returnItems.filter(i => i.returnQty > 0).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Return Qty</span>
                  <span className="font-medium">{returnItems.reduce((acc, i) => acc + i.returnQty, 0)}</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Total Debit</span>
                  <span className="text-2xl font-black text-rose-600">{formatCurrency(calculatedTotal)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason for Return</label>
                  <textarea 
                    rows={3}
                    placeholder="e.g. Expired batch, Defective goods..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                  />
                </div>

                <Button 
                  className="w-full py-6 shadow-xl shadow-amber-600/20 bg-amber-600 hover:bg-amber-700 text-white" 
                  onClick={handleSubmit} 
                  loading={submitting}
                  disabled={calculatedTotal <= 0}
                >
                  Generate Debit Note
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

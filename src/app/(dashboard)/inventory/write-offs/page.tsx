'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatCurrency, formatDate } from '@/lib/utils'

type Batch = {
  id: string
  batchNumber: string
  quantity: number
  expiryDate: string | null
  product: {
    id: string
    name: string
  }
}

type WriteOff = {
  id: string
  referenceNo: string
  reason: string
  notes: string | null
  totalAmount: number
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    amount: number
    batch: { batchNumber: string; expiryDate: string | null } | null
    product: { name: string }
  }>
}

type WriteOffItemForm = {
  batchId: string
  quantity: string
  unitCost: string
}

const reasonOptions = [
  { value: 'Expiry', label: 'Expiry' },
  { value: 'Breakage', label: 'Breakage' },
  { value: 'Damage', label: 'Damage' },
  { value: 'Wastage', label: 'Wastage' },
]

export default function StockWriteOffPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('Expiry')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<WriteOffItemForm[]>([{ batchId: '', quantity: '1', unitCost: '' }])

  const fetchData = async () => {
    try {
      const [batchRes, writeOffRes] = await Promise.all([
        fetch('/api/batches'),
        fetch('/api/inventory/write-offs'),
      ])

      const [batchData, writeOffData] = await Promise.all([batchRes.json(), writeOffRes.json()])

      if (!batchRes.ok) throw new Error(batchData.error || 'Failed to fetch batches')
      if (!writeOffRes.ok) throw new Error(writeOffData.error || 'Failed to fetch write-offs')

      setBatches(batchData)
      setWriteOffs(writeOffData)
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const addItem = () => setItems((current) => [...current, { batchId: '', quantity: '1', unitCost: '' }])

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)))
  }

  const updateItem = (index: number, patch: Partial<WriteOffItemForm>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const totalAmount = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0)
    const unitCost = Number(item.unitCost || 0)
    return sum + quantity * unitCost
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        reason,
        notes,
        entryDate,
        items: items.map((item) => ({
          batchId: item.batchId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        })),
      }

      const res = await fetch('/api/inventory/write-offs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record write-off')

      setItems([{ batchId: '', quantity: '1', unitCost: '' }])
      setNotes('')
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <AlertTriangle size={24} className="text-amber-600" /> Breakage / Expiry / Wastage
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Write off expired or destroyed stock and move the value to the loss ledger.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={reasonOptions}
              />
              <Input
                label="Entry Date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>

            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the loss, damage, or expiry context"
            />

            <div className="space-y-4">
              {items.map((item, index) => {
                const selectedBatch = batches.find((batch) => batch.id === item.batchId)
                return (
                  <div key={index} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-[2fr_0.8fr_0.9fr_auto]">
                    <Select
                      label={`Batch ${index + 1}`}
                      value={item.batchId}
                      onChange={(e) => {
                        updateItem(index, {
                          batchId: e.target.value,
                          unitCost: item.unitCost,
                        })
                      }}
                      options={batches.map((batch) => ({
                        value: batch.id,
                        label: `${batch.product.name} • ${batch.batchNumber} • Qty ${batch.quantity}`,
                      }))}
                      placeholder="Select batch"
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      max={selectedBatch?.quantity || undefined}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    />
                    <Input
                      label="Unit Cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                      placeholder="0.00"
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Remove item"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus size={16} /> Add Batch
              </Button>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-400">Loss Value</p>
                <p className="text-xl font-bold text-rose-600">{formatCurrency(totalAmount)}</p>
              </div>
            </div>

            <Button type="submit" loading={submitting} className="w-full">
              Record Write-Off
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">Recent Write-Offs</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading write-offs...</div>
          ) : writeOffs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No write-offs recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {writeOffs.map((writeOff) => (
                <div key={writeOff.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{writeOff.referenceNo}</p>
                      <p className="text-sm text-slate-500">{writeOff.reason}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(writeOff.createdAt)}</p>
                    </div>
                    <p className="font-bold text-rose-600">{formatCurrency(writeOff.totalAmount)}</p>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-500">
                    {writeOff.items.map((item) => (
                      <p key={item.id}>
                        {item.product.name} • {item.quantity} qty{item.batch ? ` • ${item.batch.batchNumber}` : ''}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}


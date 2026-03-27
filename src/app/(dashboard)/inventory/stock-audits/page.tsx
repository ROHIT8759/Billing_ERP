'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ClipboardCheck, RefreshCcw, Save, Send } from 'lucide-react'

type Godown = { id: string; name: string }
type AuditItem = {
  id: string
  expectedQty: number
  physicalQty: number
  differenceQty: number
  product: {
    id: string
    name: string
    price: number
    stock: number
    saltComposition?: string | null
  }
}
type Audit = {
  id: string
  auditDate: string
  status: string
  notes: string | null
  postedAt: string | null
  godown: Godown
  items: AuditItem[]
}

export default function StockAuditsPage() {
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const [selectedGodownId, setSelectedGodownId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [godownRes, auditRes] = await Promise.all([
        fetch('/api/godowns'),
        fetch('/api/inventory/stock-audits'),
      ])
      if (godownRes.ok) setGodowns(await godownRes.json())
      if (auditRes.ok) {
        const data = await auditRes.json()
        setAudits(data)
        if (!selectedAuditId && data[0]) {
          setSelectedAuditId(data[0].id)
          setNotes(data[0].notes || '')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const selectedAudit = useMemo(() => {
    const audit = audits.find((entry) => entry.id === selectedAuditId) || null
    if (audit && notes !== audit.notes) {
      // keep notes local once audit selected/loaded
    }
    return audit
  }, [audits, selectedAuditId, notes])

  useEffect(() => {
    if (selectedAudit) setNotes(selectedAudit.notes || '')
  }, [selectedAuditId])

  const handleCreate = async () => {
    if (!selectedGodownId) return alert('Select a godown first')
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/stock-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ godownId: selectedGodownId, notes }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to create audit')
      await fetchData()
      setSelectedAuditId(payload.id)
      setNotes(payload.notes || '')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create audit')
    } finally {
      setSaving(false)
    }
  }

  const handlePhysicalQtyChange = (itemId: string, value: string) => {
    setAudits((prev) => prev.map((audit) => {
      if (audit.id !== selectedAuditId) return audit
      return {
        ...audit,
        items: audit.items.map((item) => {
          if (item.id !== itemId) return item
          const physicalQty = Math.max(parseInt(value || '0', 10) || 0, 0)
          return {
            ...item,
            physicalQty,
            differenceQty: physicalQty - item.expectedQty,
          }
        }),
      }
    }))
  }

  const handleSave = async () => {
    if (!selectedAudit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/stock-audits/${selectedAudit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          items: selectedAudit.items.map((item) => ({
            id: item.id,
            expectedQty: item.expectedQty,
            physicalQty: item.physicalQty,
          })),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to save audit')
      setAudits((prev) => prev.map((audit) => audit.id === payload.id ? payload : audit))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save audit')
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async () => {
    if (!selectedAudit) return
    if (!confirm('Post this stock audit and create stock difference journal entries?')) return
    setSaving(true)
    try {
      const saveRes = await fetch(`/api/inventory/stock-audits/${selectedAudit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          items: selectedAudit.items.map((item) => ({
            id: item.id,
            expectedQty: item.expectedQty,
            physicalQty: item.physicalQty,
          })),
        }),
      })
      if (!saveRes.ok) {
        const payload = await saveRes.json()
        throw new Error(payload.error || 'Failed to save audit before posting')
      }

      const res = await fetch(`/api/inventory/stock-audits/${selectedAudit.id}/post`, { method: 'POST' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to post audit')
      setAudits((prev) => prev.map((audit) => audit.id === payload.id ? payload : audit))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post audit')
    } finally {
      setSaving(false)
    }
  }

  const varianceValue = (selectedAudit?.items || []).reduce(
    (sum, item) => sum + Math.abs(item.differenceQty) * item.product.price,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Audits</h1>
          <p className="text-sm text-slate-500">Count physical stock by godown and post stock difference journal entries automatically</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={selectedGodownId} onChange={(e) => setSelectedGodownId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <option value="">Select godown</option>
            {godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}
          </select>
          <Button onClick={handleCreate} loading={saving}>
            <ClipboardCheck size={16} />
            New Audit
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw size={16} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">Recent Audits</div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading audits...</div>
          ) : audits.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No audits yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {audits.map((audit) => (
                <button key={audit.id} onClick={() => setSelectedAuditId(audit.id)} className={`w-full px-4 py-3 text-left transition-colors ${selectedAuditId === audit.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{audit.godown.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(audit.auditDate)}</div>
                    </div>
                    <Badge variant={audit.status === 'posted' ? 'success' : 'warning'}>{audit.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          {!selectedAudit ? (
            <div className="p-10 text-center text-slate-500">Select an audit to start counting physical stock.</div>
          ) : (
            <>
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedAudit.godown.name}</h2>
                    <p className="text-sm text-slate-500">Audit date: {formatDate(selectedAudit.auditDate)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={selectedAudit.status === 'posted' ? 'success' : 'warning'}>{selectedAudit.status}</Badge>
                    <Badge variant="default">Variance {formatCurrency(varianceValue)}</Badge>
                  </div>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={selectedAudit.status === 'posted'} className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Audit notes" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Product</th>
                      <th className="px-5 py-3 font-medium">Salt</th>
                      <th className="px-5 py-3 text-right font-medium">Expected</th>
                      <th className="px-5 py-3 text-right font-medium">Physical</th>
                      <th className="px-5 py-3 text-right font-medium">Difference</th>
                      <th className="px-5 py-3 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedAudit.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{item.product.name}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{item.product.saltComposition || '-'}</td>
                        <td className="px-5 py-3 text-right text-slate-700">{item.expectedQty}</td>
                        <td className="px-5 py-3 text-right">
                          <input type="number" min="0" value={item.physicalQty} disabled={selectedAudit.status === 'posted'} onChange={(e) => handlePhysicalQtyChange(item.id, e.target.value)} className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
                        </td>
                        <td className={`px-5 py-3 text-right font-medium ${item.differenceQty < 0 ? 'text-red-600' : item.differenceQty > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{item.differenceQty > 0 ? `+${item.differenceQty}` : item.differenceQty}</td>
                        <td className="px-5 py-3 text-right text-slate-700">{formatCurrency(Math.abs(item.differenceQty) * item.product.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
                <Button variant="ghost" onClick={handleSave} loading={saving} disabled={selectedAudit.status === 'posted'}>
                  <Save size={16} />
                  Save Audit
                </Button>
                <Button onClick={handlePost} loading={saving} disabled={selectedAudit.status === 'posted'}>
                  <Send size={16} />
                  Post Differences
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

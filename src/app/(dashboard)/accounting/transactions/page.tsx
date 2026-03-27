'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatCurrency, formatDate } from '@/lib/utils'

// Local enum since VoucherType is not yet in Prisma schema
const VoucherType = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
} as const
type VoucherType = typeof VoucherType[keyof typeof VoucherType]

type Customer = { id: string; name: string }
type Supplier = { id: string; name: string }
type Account = { id: string; name: string; type: string; category: string }
type JournalEntry = {
  id: string
  entryNo: string
  voucherType: string
  entryDate: string
  reference: string | null
  narration: string | null
  lines: { id: string; account: { name: string }; debit: number; credit: number }[]
}

const voucherOptions = [
  { value: VoucherType.RECEIPT, label: 'Receipt' },
  { value: VoucherType.PAYMENT, label: 'Payment' },
  { value: VoucherType.CREDIT_NOTE, label: 'Credit Note' },
  { value: VoucherType.DEBIT_NOTE, label: 'Debit Note' },
]

const paymentModeOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
]

export default function AccountingTransactionsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    voucherType: VoucherType.RECEIPT as VoucherType,
    counterpartyId: '',
    expenseAccountId: '',
    paymentMode: 'CASH',
    amount: '',
    reference: '',
    narration: '',
    entryDate: new Date().toISOString().slice(0, 10),
  })

  const fetchData = async () => {
    try {
      const [customerRes, supplierRes, accountRes, entryRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/accounting/suppliers'),
        fetch('/api/accounting/accounts'),
        fetch('/api/accounting/transactions'),
      ])

      const [customerData, supplierData, accountData, entryData] = await Promise.all([
        customerRes.json(),
        supplierRes.json(),
        accountRes.json(),
        entryRes.json(),
      ])

      if (!customerRes.ok) throw new Error(customerData.error || 'Failed to load customers')
      if (!supplierRes.ok) throw new Error(supplierData.error || 'Failed to load suppliers')
      if (!accountRes.ok) throw new Error(accountData.error || 'Failed to load accounts')
      if (!entryRes.ok) throw new Error(entryData.error || 'Failed to load entries')

      setCustomers(customerData)
      setSuppliers(supplierData)
      setAccounts(accountData)
      setEntries(entryData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const expenseAccounts = useMemo(
    () => accounts.filter((account) => account.category === 'EXPENSE' && account.type === 'EXPENSE'),
    [accounts]
  )

  const isReceipt = form.voucherType === VoucherType.RECEIPT
  const isPayment = form.voucherType === VoucherType.PAYMENT
  const isCreditNote = form.voucherType === VoucherType.CREDIT_NOTE
  const isDebitNote = form.voucherType === VoucherType.DEBIT_NOTE

  const resetForm = () => {
    setForm({
      voucherType: VoucherType.RECEIPT,
      counterpartyId: '',
      expenseAccountId: '',
      paymentMode: 'CASH',
      amount: '',
      reference: '',
      narration: '',
      entryDate: new Date().toISOString().slice(0, 10),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/accounting/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post voucher')

      resetForm()
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading voucher screen...</div>
  }

  if (error) {
    return <div className="p-10 text-center text-red-500">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receipts, Payments & Notes</h1>
        <p className="text-sm text-slate-500">
          Post cash/bank receipts, supplier payments, sales returns, and purchase returns.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Select
              label="Voucher Type *"
              value={form.voucherType}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  voucherType: e.target.value as VoucherType,
                  counterpartyId: '',
                  expenseAccountId: '',
                }))
              }
              options={voucherOptions}
            />

            {(isReceipt || isCreditNote) && (
              <Select
                label="Customer *"
                value={form.counterpartyId}
                onChange={(e) => setForm((current) => ({ ...current, counterpartyId: e.target.value }))}
                options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                placeholder="Select customer"
                required
              />
            )}

            {(isDebitNote || isPayment) && (
              <Select
                label={isPayment ? 'Supplier (Optional if expense payment)' : 'Supplier *'}
                value={form.counterpartyId}
                onChange={(e) => setForm((current) => ({ ...current, counterpartyId: e.target.value }))}
                options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                placeholder="Select supplier"
                required={isDebitNote}
              />
            )}

            {isPayment && (
              <Select
                label="Expense Account"
                value={form.expenseAccountId}
                onChange={(e) => setForm((current) => ({ ...current, expenseAccountId: e.target.value }))}
                options={expenseAccounts.map((account) => ({ value: account.id, label: account.name }))}
                placeholder="Select expense account"
              />
            )}

            {(isReceipt || isPayment) && (
              <Select
                label="Payment Mode *"
                value={form.paymentMode}
                onChange={(e) => setForm((current) => ({ ...current, paymentMode: e.target.value }))}
                options={paymentModeOptions}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount *"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
                required
              />
              <Input
                label="Entry Date *"
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm((current) => ({ ...current, entryDate: e.target.value }))}
                required
              />
            </div>

            <Input
              label="Reference"
              value={form.reference}
              onChange={(e) => setForm((current) => ({ ...current, reference: e.target.value }))}
              placeholder="Receipt no, cheque no, return ref..."
            />

            <Input
              label="Narration"
              value={form.narration}
              onChange={(e) => setForm((current) => ({ ...current, narration: e.target.value }))}
              placeholder="Optional note for the ledger"
            />

            <Button type="submit" className="w-full" loading={submitting}>
              Post Voucher
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Recent Vouchers</h2>
            <p className="text-sm text-slate-500">Every entry here is posted to the general ledger.</p>
          </div>

          {entries.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No vouchers recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Entry</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Narration</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const amount = entry.lines.reduce((sum, line) => sum + line.debit, 0)

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{entry.entryNo}</span>
                            <Badge variant="info">{entry.voucherType.replaceAll('_', ' ')}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(entry.entryDate)}</td>
                        <td className="px-6 py-4 text-slate-600">{entry.narration || entry.reference || '-'}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

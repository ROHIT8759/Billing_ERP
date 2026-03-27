'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BookOpen, Calendar as CalendarIcon, ArrowRightLeft } from 'lucide-react'

type JournalLine = { id: string; debit: number; credit: number; account: { name: string; type: string } }
type JournalEntry = {
  id: string
  entryNo: string
  voucherType: string
  entryDate: string
  reference: string | null
  narration: string | null
  lines: JournalLine[]
}

export default function DayBookPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDayBook = async (selectedDate: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/day-book?date=${selectedDate}`)
      if (!res.ok) throw new Error('Failed to load day book')
      const data = await res.json()
      setEntries(data)
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDayBook(date)
  }, [date])

  const totalDebits = entries.reduce((sum, entry) => 
    sum + entry.lines.reduce((s, line) => s + line.debit, 0), 0)
    
  // Since accounting uses double-entry, total credits should match total debits, 
  // but let's calculate them anyway just in case
  const totalCredits = entries.reduce((sum, entry) => 
    sum + entry.lines.reduce((s, line) => s + line.credit, 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-600" /> Day Book
          </h1>
          <p className="text-slate-500 text-sm mt-1">Detailed daily transaction log (Debits & Credits)</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl shadow-sm">
          <CalendarIcon size={18} className="text-slate-400" />
          <input 
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border-none focus:ring-0 text-slate-700 font-medium bg-transparent outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse">Loading day book...</div>
      ) : entries.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <ArrowRightLeft size={32} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-700">No Transactions</h3>
          <p className="text-slate-500 mt-1">No vouchers were recorded on {formatDate(date)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Card className="p-4 bg-indigo-50/50 border-indigo-100">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wilder mb-1">Total Debits</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalDebits)}</p>
            </Card>
            <Card className="p-4 bg-emerald-50/50 border-emerald-100">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wilder mb-1">Total Credits</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalCredits)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] whitespace-nowrap">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2 border-r border-slate-200">Voucher Details</th>
                    <th className="px-3 py-2 border-r border-slate-200">Particulars (Accounts)</th>
                    <th className="px-3 py-2 text-right border-r border-slate-200">Debit (₹)</th>
                    <th className="px-3 py-2 text-right border-r border-slate-200">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-3 py-2 align-top w-64 border-r border-slate-100">
                        <div className="font-semibold text-slate-900">{entry.voucherType.replace('_', ' ')}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5 font-mono">{entry.entryNo}</div>
                        {entry.reference && <div className="text-slate-500 text-[11px] mt-0.5">Ref: {entry.reference}</div>}
                        <div className="text-slate-400 text-[10px] mt-1">{new Date(entry.entryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-3 py-2 p-0 border-r border-slate-100">
                        {/* Nested Table for Lines */}
                        <div className="flex flex-col gap-1 w-full min-w-[250px]">
                          {entry.lines.map((line, i) => (
                            <div key={line.id} className={`flex items-start ${line.credit > 0 ? 'ml-6' : ''}`}>
                              <span className="font-medium text-slate-700">
                                {line.credit > 0 ? 'To ' : ''}{line.account.name}
                              </span>
                            </div>
                          ))}
                          {entry.narration && (
                            <div className="mt-2 text-xs italic text-slate-500 text-wrap w-full">
                              ({entry.narration})
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right border-r border-slate-100">
                        <div className="flex flex-col gap-1">
                          {entry.lines.map((line) => (
                            <div key={line.id} className="h-5 flex items-center justify-end">
                              {line.debit > 0 ? <span className="font-semibold text-slate-900">{formatCurrency(line.debit)}</span> : null}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <div className="flex flex-col gap-1">
                          {entry.lines.map((line) => (
                            <div key={line.id} className="h-5 flex items-center justify-end">
                              {line.credit > 0 ? <span className="font-semibold text-slate-900">{formatCurrency(line.credit)}</span> : null}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

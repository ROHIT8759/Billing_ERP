'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scan } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type Supplier = { id: string; name: string; outstandingBalance: number }
type Product = { id: string; name: string; price: number; stock: number; pack?: string }

type LineItem = {
  productId?: string
  productName: string
  pack: string
  batch: string
  quantity: string
  free: string
  price: string
  discount: string
  amount: number
}

const EMPTY_ITEM = (): LineItem => ({
  productName: '', pack: '', batch: '', quantity: '', free: '', price: '', discount: '', amount: 0
})

export default function NewPurchasePage() {
  const router = useRouter()
  
  // States
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  const [supplierId, setSupplierId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [entryNo, setEntryNo] = useState('P000008')
  const [partyNo, setPartyNo] = useState('1234')
  
  const [items, setItems] = useState<LineItem[]>(Array(18).fill(null).map(EMPTY_ITEM))
  
  // Date formatted
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then(r => r.json()).catch(() => ({ suppliers: [] })),
      fetch('/api/products').then(r => r.json()).catch(() => ([])),
    ]).then(([supData, prodData]) => {
      setSuppliers(supData.suppliers || [])
      setProducts(prodData || [])
    })

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        router.push('/purchases/scan')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  const calcAmount = (qty: string, price: string, dis: string) => {
    const q = parseFloat(qty) || 0
    const p = parseFloat(price) || 0
    const d = parseFloat(dis) || 0
    const val = q * p
    return val - (val * (d / 100))
  }

  const handleItemChange = (index: number, field: keyof LineItem, val: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: val }
    if (field === 'quantity' || field === 'price' || field === 'discount') {
      newItems[index].amount = calcAmount(
        field === 'quantity' ? val : newItems[index].quantity,
        field === 'price' ? val : newItems[index].price,
        field === 'discount' ? val : newItems[index].discount
      )
    }
    setItems(newItems)
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)

  // Marg UI Replicating CSS Classes
  const gridInputClass = "w-full h-full px-1 text-[13px] font-bold outline-none bg-transparent focus:bg-[#000080] focus:text-white"
  const labelClass = "text-[#03437e] text-[13px] font-medium min-w-[60px]"
  const valClass = "text-black text-[13px] font-bold border-none outline-none bg-transparent"

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-[#000080] selection:text-white overflow-hidden" 
         style={{ zoom: '0.95', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      
      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-[#f0f9ff] border-2 border-slate-400 w-full h-[100vh] shadow-lg">
        
        {/* Top Teal Ribbon */}
        <div className="bg-[#5e8082] text-white flex justify-between items-center px-2 py-0.5 border-b border-slate-300">
          <div className="font-bold text-[14px]">PURCHASE ENTRY</div>
          
          <div className="flex items-center gap-4">
            <Link href="/purchases/scan">
              <button 
                type="button"
                className="px-2 py-0.5 bg-teal-600 hover:bg-teal-500 border border-teal-400 rounded shadow-sm text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Press F11 to Scan Invoice"
              >
                <Scan className="w-3.5 h-3.5" />
                F11 - SCAN INVOICE
              </button>
            </Link>
            
            <div className="font-mono text-[12px] font-bold tracking-tight">
              {today} |Thu|P| 12:50:17
            </div>
          </div>
        </div>

        {/* Sub-header Form */}
        <div className="p-1 pb-2 border-b-2 border-slate-400">
          <div className="grid grid-cols-[1fr_250px] gap-4 mb-1">
             <div className="flex items-center">
               <span className={labelClass}>Name</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input 
                 value={vendorName}
                 onChange={(e) => setVendorName(e.target.value)}
                 className={cn(valClass, "uppercase flex-1 border-none focus:bg-[#000080] focus:text-white px-1")}
               />
             </div>
             <div className="flex items-center">
               <span className={labelClass}>Date</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input value={today} readOnly className={cn(valClass, "w-[120px] focus:bg-[#000080] focus:text-white px-1")} />
             </div>
          </div>
          
          <div className="grid grid-cols-[300px_300px_300px_1fr] gap-4">
             <div className="flex items-center">
               <span className={labelClass}>Entry No</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input 
                 value={entryNo}
                 onChange={(e) => setEntryNo(e.target.value)}
                 className={cn(valClass, "w-[150px] focus:bg-[#000080] focus:text-white px-1 uppercase")}
               />
             </div>
             <div className="flex items-center">
               <span className={labelClass}>Party No</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input 
                 value={partyNo}
                 onChange={(e) => setPartyNo(e.target.value)}
                 className={cn(valClass, "w-[150px] focus:bg-[#000080] focus:text-white px-1 uppercase")}
               />
             </div>
             <div className="flex items-center">
               <span className={labelClass}>Dt</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input 
                 value={today}
                 readOnly
                 className={cn(valClass, "w-[120px] focus:bg-[#000080] focus:text-white px-1")}
               />
             </div>
             <div className="flex items-center">
               <span className={labelClass}>Type</span>
               <span className="text-[#03437e] font-bold mx-2">:</span>
               <input 
                 value="LOCAL"
                 readOnly
                 className={cn(valClass, "w-[100px] focus:bg-[#000080] focus:text-white px-1")}
               />
             </div>
          </div>
        </div>

        {/* Info Strip */}
        <div className="text-center text-[10px] text-[#000080] font-bold py-1 border-b border-t border-slate-400">
          -[ <span className="text-purple-700">Import -&gt; F10-Online F11-Scan QRCode</span> ]-
        </div>

        {/* Data Grid Area */}
        <div className="flex-1 flex flex-col border-t-2 border-slate-400 overflow-hidden bg-white">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-[#e2e9cb] border-b-2 border-slate-400">
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[13px] font-bold text-[#445b4c] w-[35%] tracking-wide">PRODUCT</th>
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[13px] font-bold text-[#445b4c] w-[8%] tracking-wide">PACK</th>
                <th className="border-r border-slate-400 py-1 px-1 text-left text-[13px] font-bold text-[#445b4c] w-[12%] tracking-wide">BATCH</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[13px] font-bold text-[#445b4c] w-[7%] tracking-wide">QTY</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[13px] font-bold text-[#445b4c] w-[7%] tracking-wide">FREE</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[13px] font-bold text-[#445b4c] w-[10%] tracking-wide">P.RATE</th>
                <th className="border-r border-slate-400 py-1 px-1 text-right text-[13px] font-bold text-[#445b4c] w-[8%] tracking-wide">DIS1%</th>
                <th className="py-1 px-1 text-right text-[13px] font-bold text-[#445b4c] w-[13%] tracking-wide">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-300 h-6">
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={gridInputClass} 
                      value={item.productName} 
                      onChange={e => handleItemChange(idx, 'productName', e.target.value)} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={gridInputClass} 
                      value={item.pack} 
                      onChange={e => handleItemChange(idx, 'pack', e.target.value)} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={gridInputClass} 
                      value={item.batch} 
                      onChange={e => handleItemChange(idx, 'batch', e.target.value)} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={cn(gridInputClass, "text-right")} 
                      value={item.quantity} 
                      onChange={e => handleItemChange(idx, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={cn(gridInputClass, "text-right")} 
                      value={item.free} 
                      onChange={e => handleItemChange(idx, 'free', e.target.value.replace(/[^0-9]/g, ''))} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={cn(gridInputClass, "text-right")} 
                      value={item.price} 
                      onChange={e => handleItemChange(idx, 'price', e.target.value.replace(/[^0-9.]/g, ''))} 
                    />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input 
                      className={cn(gridInputClass, "text-right")} 
                      value={item.discount} 
                      onChange={e => handleItemChange(idx, 'discount', e.target.value.replace(/[^0-9.]/g, ''))} 
                    />
                  </td>
                  <td className="p-0 text-right px-1 text-[13px] font-bold text-black bg-[#fafafa]">
                    {item.amount > 0 ? item.amount.toFixed(2) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex-1 bg-white" onClick={() => {
              // Click empty space to add item
              setItems(prev => [...prev, EMPTY_ITEM()])
          }}></div>
        </div>

        {/* Footer 3 Columns Area */}
        <div className="h-[120px] bg-[#f0f9ff] border-t-2 border-slate-500 grid grid-cols-[1fr_200px_250px] text-[13px]">
          {/* Col 1 */}
          <div className="border-r border-slate-400 p-1 font-mono grid grid-cols-[auto_1fr] grid-rows-5 gap-x-2 gap-y-0 text-[12px]">
            <span className="text-[#03437e]">Item <span className="mx-1">:</span></span> <span className="font-bold text-green-700"></span>
            <span className="text-[#03437e]">Batch <span className="mx-1">:</span></span> <span></span>
            <span className="text-[#03437e]">Expiry:</span> <span className="flex justify-between w-[200px]"><span>/</span> <span className="text-[#03437e]">Stock:</span> <span></span></span>
            <span className="text-[#03437e]">M.R.P.:</span> <span className="flex justify-between w-[200px]"><span></span> <span className="text-[#03437e]">SRate:</span> <span></span></span>
            <span className="text-[#03437e]">Chall.:</span> <span className="flex justify-between w-[200px]"><span></span> <span className="text-[#03437e]">Date :</span> <span></span></span>
          </div>

          {/* Col 2 */}
          <div className="border-r border-slate-400 p-1 font-mono text-[12px]">
             <div className="flex justify-between"><span className="text-[#03437e]">MRP Value :</span> <span>0.00</span></div>
             <div className="flex justify-between"><span className="text-[#03437e]">Amount &nbsp; :</span> <span>{totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}</span></div>
             <div className="flex justify-between"><span className="text-[#03437e]">Balance &nbsp; :</span> <span>0.00</span></div>
          </div>

          {/* Col 3 */}
          <div className="p-1 font-mono text-[12px] bg-[#f0f9ff]">
             <div className="flex justify-between font-bold text-[#03437e]"><span>VALUE OF GOODS &nbsp;:</span> <span className="text-black">{totalAmount > 0 ? totalAmount.toFixed(2) : ''}</span></div>
             <div className="flex justify-between text-[#03437e]"><span>DISCOUNT &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span> <span></span></div>
             <div className="flex justify-between text-[#03437e]"><span>GST &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span> <span></span></div>
             <div className="flex justify-between text-[#03437e] mt-4"><span></span> <span>:</span> <span></span></div>
             <div className="flex justify-between text-[#03437e]"><span></span> <span>:</span> <span></span></div>
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="bg-[#5e8082] text-white flex items-center justify-between text-[11px] font-bold border-t border-slate-700">
          <div className="flex items-center">
            <span className="bg-red-600 px-2 py-0.5 border border-red-800">HELP</span>
            <div className="flex border-l border-r border-[#425f54] mx-2 uppercase tracking-wide">
               {['SALE','PURC','SC','PC','COPY','PASTE','SR','PR','O/S','BE','CASH','VOU','HOLD','PUSH'].map(btn => (
                 <span key={btn} className="px-1.5 py-0.5 border-r border-[#8aa6a7] cursor-pointer hover:bg-slate-500 hover:text-white transition-colors">{btn}</span>
               ))}
               <span className="px-2 py-0.5 bg-[#4a0d14] text-[#ffb8c6] border-r border-[#8aa6a7] uppercase tracking-wide cursor-pointer hover:bg-red-900 transition-colors">SAVE</span>
            </div>
          </div>
          <div className="px-2 flex space-x-2 text-[10px]">
             <span>📞</span>
             <span>CH-AT</span>
             <span>⏳</span>
          </div>
        </div>
      </div>
      
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Plus, Package, ShoppingCart, Truck, UserCircle, Bell, Search } from 'lucide-react'

interface TopBarProps {
  shopName: string
  userEmail: string
}

export function TopBar({ shopName, userEmail }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 sticky top-0 shadow-sm">
      <div className="flex items-center gap-6">
        {/* Quick Actions (Marg Style) */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/sales/new" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition-colors">
            <ShoppingCart size={14} /> New Sale (Alt+S)
          </Link>
          <Link href="/purchases/new" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors">
            <Truck size={14} /> Add Purchase
          </Link>
          <Link href="/products/new" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors">
            <Package size={14} /> Add Product
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:block w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Global search (Ctrl+K)..." 
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-4">
          <button className="text-slate-400 hover:text-indigo-600 transition-colors">
            <Bell size={18} />
          </button>
          
          <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none mb-0.5">{shopName}</p>
              <p className="text-[10px] text-slate-500">{userEmail}</p>
            </div>
            <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <UserCircle size={20} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

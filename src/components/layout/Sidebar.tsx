'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Building2,
  BookOpen,
  LogOut,
  Store,
  Scan,
  Tag,
  Warehouse,
  Layers,
  ClipboardList,
  Barcode,
  PieChart,
  LineChart,
  Target,
  FileText,
  RotateCcw,
  ArchiveRestore,
  AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/purchases', icon: Truck, label: 'Purchases' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/customers', icon: Users, label: 'Customers' },
  { href: '/suppliers', icon: Building2, label: 'Suppliers' },
  { href: '/accounting', icon: BookOpen, label: 'Accounting' },
]

interface SidebarProps {
  shopName?: string
}

export function Sidebar({ shopName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-40 overflow-hidden shadow-sm">
      {/* Logo */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
            <Store size={16} className="text-white" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-[13px] uppercase tracking-wide leading-tight">Smart Billing</p>
            <p className="text-slate-500 text-[10px] uppercase font-semibold truncate max-w-32.5">
              {shopName || 'ERP System'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
        
        <div className="space-y-0.5 px-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'border-l-4 border-indigo-600 bg-indigo-50/50 text-indigo-700 rounded-r-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent rounded-r-sm'
                )}
              >
                <Icon size={16} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                {label}
              </Link>
            )
          })}
        </div>

        <div className="pt-2 mt-2 border-t border-slate-100">
          <div className="px-2 space-y-0.5">
            <Link
              href="/purchases/scan"
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-all duration-150',
                pathname === '/purchases/scan'
                  ? 'border-l-4 border-amber-500 bg-amber-50 text-amber-700 rounded-r-sm'
                  : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50 border-l-4 border-transparent rounded-r-sm'
              )}
            >
              <Scan size={16} className={pathname === '/purchases/scan' ? "text-amber-600" : "text-amber-400"} />
              AI Invoice Scanner
            </Link>
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-slate-100">
          <p className="px-5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Returns</p>
          <div className="px-2 space-y-0.5">
            {[
              { href: '/sales-returns', icon: RotateCcw, label: 'Credit Notes' },
              { href: '/purchase-returns', icon: ArchiveRestore, label: 'Debit Notes' },
            ].map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'border-l-4 border-slate-700 bg-slate-100 text-slate-900 rounded-r-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent rounded-r-sm'
                  )}
                >
                  <Icon size={14} className={isActive ? "text-slate-700" : "text-slate-400"} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-slate-100">
          <p className="px-5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory</p>
          <div className="px-2 space-y-0.5">
            {[
              { href: '/inventory/godowns', icon: Warehouse, label: 'Godowns' },
              { href: '/inventory/batches', icon: Layers, label: 'Batches & Expiry' },
              { href: '/inventory/write-offs', icon: AlertTriangle, label: 'Wastage / Write-Off' },
              { href: '/inventory/purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
              { href: '/inventory/barcodes', icon: Barcode, label: 'Barcodes' },
            ].map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'border-l-4 border-slate-700 bg-slate-100 text-slate-900 rounded-r-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent rounded-r-sm'
                  )}
                >
                  <Icon size={14} className={isActive ? "text-slate-700" : "text-slate-400"} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-slate-100">
          <p className="px-5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pricing</p>
          <div className="px-2 space-y-0.5">
            {[
              { href: '/pricing/schemes', icon: Tag, label: 'Schemes' },
            ].map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'border-l-4 border-slate-700 bg-slate-100 text-slate-900 rounded-r-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent rounded-r-sm'
                  )}
                >
                  <Icon size={14} className={isActive ? "text-slate-700" : "text-slate-400"} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-slate-100 pb-10">
          <p className="px-5 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">MIS Reports</p>
          <div className="px-2 space-y-0.5">
            {[
              { href: '/reports/day-book', icon: FileText, label: 'Day Book' },
              { href: '/reports/stock-valuation', icon: PieChart, label: 'Stock Valuation' },
              { href: '/reports/expiry', icon: Target, label: 'Expiry Tracker' },
              { href: '/reports/outstanding', icon: LineChart, label: 'Party Outstanding' },
            ].map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'border-l-4 border-slate-700 bg-slate-100 text-slate-900 rounded-r-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-4 border-transparent rounded-r-sm'
                  )}
                >
                  <Icon size={14} className={isActive ? "text-slate-700" : "text-slate-400"} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-slate-200 bg-slate-50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-sm text-[13px] font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-transparent transition-all duration-150"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}


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
  BookOpen,
  LogOut,
  Store,
  Scan,
  Warehouse,
  Layers,
  ClipboardList,
  Barcode,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/purchases', icon: Truck, label: 'Purchases' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/customers', icon: Users, label: 'Customers' },
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
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Store size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Smart Billing</p>
            <p className="text-slate-400 text-xs truncate max-w-[130px]">
              {shopName || 'ERP System'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}

        <div className="pt-2 border-t border-slate-700/50 mt-4">
          <Link
            href="/purchases/scan"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              pathname === '/purchases/scan'
                ? 'bg-indigo-600 text-white'
                : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
            )}
          >
            <Scan size={18} />
            AI Invoice Scanner
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-700/50 mt-4">
          <p className="px-3 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory</p>
          {[
            { href: '/inventory/godowns', icon: Warehouse, label: 'Godowns' },
            { href: '/inventory/batches', icon: Layers, label: 'Batches & Expiry' },
            { href: '/inventory/purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
            { href: '/inventory/barcodes', icon: Barcode, label: 'Barcodes' },
          ].map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all duration-200"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

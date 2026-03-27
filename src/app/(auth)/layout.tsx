import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login | Smart Billing ERP',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {children}
    </div>
  )
}

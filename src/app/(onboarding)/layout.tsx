import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Onboarding | Smart Billing ERP',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-12">
      {children}
    </div>
  )
}

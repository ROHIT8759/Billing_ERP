import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if shop exists, if not redirect to onboarding
  const shop = await prisma.shop.findUnique({
    where: { userId: user.id },
  })

  if (!shop) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar shopName={shop.shopName} />
      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        <TopBar shopName={shop.shopName} userEmail={user.email || 'User'} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

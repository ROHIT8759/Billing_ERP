import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const shop = await prisma.shop.findUnique({ where: { userId: user.id } })

  if (!shop) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}

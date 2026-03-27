import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // Callback route doesn't need to set cookies here, middle handles it
          },
        },
      }
    )
    
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Sync user to Prisma if not exists
      await prisma.user.upsert({
        where: { email: data.user.email! },
        update: {},
        create: {
          id: data.user.id,
          email: data.user.email!,
        }
      })

      // Check if shop exists
      const shop = await prisma.shop.findUnique({
        where: { userId: data.user.id }
      })

      if (shop) {
        return NextResponse.redirect(`${origin}/dashboard`)
      } else {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}

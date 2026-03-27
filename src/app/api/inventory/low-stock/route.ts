import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Products where reorderLevel is set and stock <= reorderLevel
    const products = await prisma.$queryRaw<
      Array<{ id: string; name: string; category: string | null; stock: number; reorderLevel: number }>
    >`
      SELECT id, name, category, stock, "reorderLevel"
      FROM "Product"
      WHERE "shopId" = ${shop.id}
        AND "reorderLevel" IS NOT NULL
        AND stock <= "reorderLevel"
      ORDER BY (stock - "reorderLevel") ASC
    `

    return NextResponse.json(products)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

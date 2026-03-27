import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
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

    const { fromGodownId, toGodownId, productId, quantity } = await request.json()
    if (!fromGodownId || !toGodownId || !productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'fromGodownId, toGodownId, productId, and quantity > 0 are required' }, { status: 400 })
    }
    if (fromGodownId === toGodownId) {
      return NextResponse.json({ error: 'Source and destination godowns must differ' }, { status: 400 })
    }

    // Verify both godowns belong to this shop
    const [from, to] = await Promise.all([
      prisma.godown.findUnique({ where: { id: fromGodownId } }),
      prisma.godown.findUnique({ where: { id: toGodownId } }),
    ])
    if (!from || from.shopId !== shop.id || !to || to.shopId !== shop.id) {
      return NextResponse.json({ error: 'Godown not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Decrement source
      const src = await tx.godownStock.findUnique({ where: { godownId_productId: { godownId: fromGodownId, productId } } })
      if (!src || src.quantity < quantity) throw new Error('Insufficient stock in source godown')

      await tx.godownStock.update({
        where: { godownId_productId: { godownId: fromGodownId, productId } },
        data: { quantity: { decrement: quantity } }
      })

      // Upsert destination
      await tx.godownStock.upsert({
        where: { godownId_productId: { godownId: toGodownId, productId } },
        update: { quantity: { increment: quantity } },
        create: { godownId: toGodownId, productId, quantity }
      })
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

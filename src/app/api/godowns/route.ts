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

    const godowns = await prisma.godown.findMany({
      where: { shopId: shop.id },
      include: {
        stock: { include: { product: { select: { id: true, name: true, price: true } } } },
        _count: { select: { stock: true, batches: true } }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    })

    return NextResponse.json(godowns)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const { name, address, isDefault } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    if (isDefault) {
      await prisma.godown.updateMany({ where: { shopId: shop.id }, data: { isDefault: false } })
    }

    const godown = await prisma.godown.create({
      data: { shopId: shop.id, name: name.trim(), address: address?.trim() || null, isDefault: isDefault ?? false }
    })
    return NextResponse.json(godown)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const customers = await prisma.customer.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { invoices: true }
        }
      }
    })

    return NextResponse.json(customers)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { name, phone, email, address } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
      }
    })

    return NextResponse.json(customer)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

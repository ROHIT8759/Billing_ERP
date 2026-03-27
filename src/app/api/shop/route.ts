import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup } from '@/lib/accounting'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shopName, ownerName, gstNumber, phone, email, address, state, pincode } = body

    if (!shopName || !ownerName || !phone || !address || !state || !pincode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user already has a shop
    const existingShop = await prisma.shop.findUnique({
      where: { userId: user.id }
    })

    if (existingShop) {
      return NextResponse.json({ error: 'User already has a shop configured' }, { status: 400 })
    }

    // Ensure user exists in our public User table (Supabase auth.users ≠ public.User)
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email! },
      create: { id: user.id, email: user.email! },
    })

    const shop = await prisma.shop.create({
      data: {
        userId: user.id,
        shopName,
        ownerName,
        gstNumber: gstNumber || null,
        phone,
        email: email || null,
        address,
        state,
        pincode,
      }
    })

    await ensureAccountingSetup(shop.id)

    return NextResponse.json(shop)
  } catch (error: any) {
    console.error('Shop creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shop = await prisma.shop.findUnique({
      where: { userId: user.id }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    return NextResponse.json(shop)
  } catch (error: any) {
    console.error('Shop fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

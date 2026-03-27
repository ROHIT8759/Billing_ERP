import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function authorize(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const shop = await prisma.shop.findUnique({ where: { userId: user.id } })
  if (!shop) return null
  const godown = await prisma.godown.findUnique({ where: { id } })
  if (!godown || godown.shopId !== shop.id) return null
  return { shop, godown }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { name, address, isDefault } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    if (isDefault) {
      await prisma.godown.updateMany({ where: { shopId: auth.shop.id }, data: { isDefault: false } })
    }

    const godown = await prisma.godown.update({
      where: { id },
      data: { name: name.trim(), address: address?.trim() || null, isDefault: isDefault ?? auth.godown.isDefault }
    })
    return NextResponse.json(godown)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await prisma.godown.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

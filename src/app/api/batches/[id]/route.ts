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
  const batch = await prisma.batch.findUnique({ where: { id } })
  if (!batch || batch.shopId !== shop.id) return null
  return { shop, batch }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { batchNumber, mfgDate, expiryDate, quantity, godownId } = await request.json()

    const batch = await prisma.batch.update({
      where: { id },
      data: {
        batchNumber: batchNumber?.trim() ?? auth.batch.batchNumber,
        mfgDate: mfgDate ? new Date(mfgDate) : auth.batch.mfgDate,
        expiryDate: expiryDate ? new Date(expiryDate) : auth.batch.expiryDate,
        quantity: quantity != null ? parseInt(quantity) : auth.batch.quantity,
        godownId: godownId !== undefined ? (godownId || null) : auth.batch.godownId,
      },
      include: {
        product: { select: { id: true, name: true } },
        godown: { select: { id: true, name: true } },
      }
    })
    return NextResponse.json(batch)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if (!auth) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await prisma.batch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        shop: true
      }
    })

    if (!invoice || invoice.shopId !== shop.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const existing = await prisma.invoice.findUnique({ where: { id }, include: { items: true } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Optional: Return stock to products when deleting an invoice?
    // Doing it for complete robustness
    await prisma.$transaction(async (tx: any) => {
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
      }
      await tx.invoice.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    const existing = await prisma.purchase.findUnique({ where: { id }, include: { items: true } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // Optional: Return stock to products when deleting a purchase?
    // We'll reverse the operation we did on create
    await prisma.$transaction(async (tx: any) => {
      for (const item of existing.items) {
        if (item.productName) {
          const product = await tx.product.findFirst({
            where: { shopId: shop.id, name: { equals: item.productName, mode: 'insensitive' } }
          })
          if (product) {
             // Reverse the stock increment
             await tx.product.update({
               where: { id: product.id },
               data: { stock: { decrement: item.quantity } }
             })
          }
        }
      }
      await tx.purchase.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

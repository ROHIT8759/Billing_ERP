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

    const invoices = await prisma.invoice.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: true,
      }
    })

    return NextResponse.json(invoices)
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
    const { customerId, items, totalAmount, gstAmount } = body

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer and at least one item are required' }, { status: 400 })
    }

    // Generate Invoice Number (Format: INV-YYYYMMDD-XXXX)
    const date = new Date()
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
    const count = await prisma.invoice.count({
      where: { 
        shopId: shop.id,
        createdAt: { gte: new Date(date.setHours(0,0,0,0)) }
      }
    })
    const invoiceNo = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`

    // Use a transaction to create invoice, add items, and decrement stock
    const invoice = await prisma.$transaction(async (tx: any) => {
      // Create Invoice
      const newInvoice = await tx.invoice.create({
        data: {
          shopId: shop.id,
          customerId,
          invoiceNo,
          totalAmount: parseFloat(totalAmount),
          gstAmount: parseFloat(gstAmount || 0),
          status: 'paid',
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: parseInt(item.quantity, 10),
              price: parseFloat(item.price)
            }))
          }
        },
        include: {
          customer: true,
          items: true
        }
      })

      // Decrement product stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: parseInt(item.quantity, 10) }
          }
        })
      }

      return newInvoice
    })

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Invoice creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

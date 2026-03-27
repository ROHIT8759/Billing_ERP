import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup, ensureCustomerAccount } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

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
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { name, phone, email, address, state, priceLevel } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          shopId: shop.id,
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          state: state || null,
          priceLevel: priceLevel || 'RETAIL',
        }
      })

      await ensureCustomerAccount(tx, shop.id, newCustomer.id, newCustomer.name)

      return tx.customer.findUnique({
        where: { id: newCustomer.id },
        include: { account: true },
      })
    })

    return NextResponse.json(customer)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

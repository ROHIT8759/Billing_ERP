import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup, ensureSupplierAccount } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const suppliers = await prisma.supplier.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        account: true,
        purchases: {
          select: {
            id: true,
          },
        },
      },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Suppliers fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { name, phone, email, address } = body

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const newSupplier = await tx.supplier.create({
        data: {
          shopId: shop.id,
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
        },
      })

      await ensureSupplierAccount(tx, shop.id, newSupplier.id, newSupplier.name)

      return tx.supplier.findUnique({
        where: { id: newSupplier.id },
        include: { account: true },
      })
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

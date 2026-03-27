import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup, ensureSupplierAccount } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

type SupplierRouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, context: SupplierRouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const existing = await prisma.supplier.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, phone, email, address, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      })

      const account = await ensureSupplierAccount(tx, shop.id, updated.id, updated.name)

      await tx.account.update({
        where: { id: account.id },
        data: {
          openingBalance: Number(openingBalance || 0),
        },
      })

      return tx.supplier.findUnique({
        where: { id },
        include: {
          account: true,
          purchases: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              totalAmount: true,
              createdAt: true,
              vendorName: true,
            },
          },
        },
      })
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: SupplierRouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    if (existing.purchases.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a supplier with recorded purchases' },
        { status: 400 }
      )
    }

    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSupplierAccount } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.supplier.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, phone, email, address } = body

    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
        },
      })

      await ensureSupplierAccount(tx, shop.id, updated.id, updated.name)

      return tx.supplier.findUnique({
        where: { id },
        include: { account: true },
      })
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { purchases: { select: { id: true } } },
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

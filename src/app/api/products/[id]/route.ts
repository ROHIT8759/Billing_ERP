import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      category,
      price,
      stock,
      reorderLevel,
      barcode,
      hsnCode,
      gstRate,
      mrp,
      retailRate,
      wholesaleRate,
      distributorRate,
      saltComposition,
      minStockLevel,
      maxStockLevel,
      reorderQuantity,
      primarySupplierId,
    } = body

    if (primarySupplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: primarySupplierId } })
      if (!supplier || supplier.shopId !== shop.id) {
        return NextResponse.json({ error: 'Primary supplier not found' }, { status: 400 })
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        category: category !== undefined ? (category || null) : undefined,
        price: price !== undefined ? parseFloat(String(price)) : undefined,
        stock: stock !== undefined ? parseInt(String(stock), 10) : undefined,
        reorderLevel: reorderLevel !== undefined ? (reorderLevel === '' || reorderLevel === null ? null : parseInt(String(reorderLevel), 10)) : undefined,
        barcode: barcode !== undefined ? (barcode?.trim() || null) : undefined,
        hsnCode: hsnCode !== undefined ? (hsnCode?.trim() || null) : undefined,
        gstRate: gstRate !== undefined ? parseFloat(String(gstRate)) : undefined,
        mrp: mrp !== undefined ? (mrp === '' || mrp === null ? null : parseFloat(String(mrp))) : undefined,
        retailRate: retailRate !== undefined ? (retailRate === '' || retailRate === null ? null : parseFloat(String(retailRate))) : undefined,
        wholesaleRate: wholesaleRate !== undefined ? (wholesaleRate === '' || wholesaleRate === null ? null : parseFloat(String(wholesaleRate))) : undefined,
        distributorRate: distributorRate !== undefined ? (distributorRate === '' || distributorRate === null ? null : parseFloat(String(distributorRate))) : undefined,
        saltComposition: saltComposition !== undefined ? (saltComposition?.trim() || null) : undefined,
        minStockLevel: minStockLevel !== undefined ? (minStockLevel === '' || minStockLevel === null ? null : parseInt(String(minStockLevel), 10)) : undefined,
        maxStockLevel: maxStockLevel !== undefined ? (maxStockLevel === '' || maxStockLevel === null ? null : parseInt(String(maxStockLevel), 10)) : undefined,
        reorderQuantity: reorderQuantity !== undefined ? (reorderQuantity === '' || reorderQuantity === null ? null : parseInt(String(reorderQuantity), 10)) : undefined,
        primarySupplierId: primarySupplierId !== undefined ? (primarySupplierId || null) : undefined,
      },
      include: {
        primarySupplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Product PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shop.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

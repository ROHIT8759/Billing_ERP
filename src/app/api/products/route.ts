import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const products = await prisma.product.findMany({
      where: { shopId: shop.id },
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const {
      name,
      category,
      price,
      stock,
      hsnCode,
      gstRate,
      mrp,
      retailRate,
      wholesaleRate,
      distributorRate,
      saltComposition,
      minStockLevel,
      reorderLevel,
      maxStockLevel,
      reorderQuantity,
      primarySupplierId,
      barcode,
    } = body

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
    }

    if (primarySupplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: primarySupplierId } })
      if (!supplier || supplier.shopId !== shop.id) {
        return NextResponse.json({ error: 'Primary supplier not found' }, { status: 400 })
      }
    }

    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: String(name).trim(),
        category: category || null,
        price: parseFloat(String(price)),
        stock: parseInt(String(stock ?? 0), 10),
        hsnCode: hsnCode?.trim() || null,
        gstRate: parseFloat(String(gstRate ?? 18)),
        mrp: mrp !== undefined && mrp !== '' ? parseFloat(String(mrp)) : null,
        retailRate: retailRate !== undefined && retailRate !== '' ? parseFloat(String(retailRate)) : null,
        wholesaleRate: wholesaleRate !== undefined && wholesaleRate !== '' ? parseFloat(String(wholesaleRate)) : null,
        distributorRate: distributorRate !== undefined && distributorRate !== '' ? parseFloat(String(distributorRate)) : null,
        saltComposition: saltComposition?.trim() || null,
        minStockLevel: minStockLevel !== undefined && minStockLevel !== '' ? parseInt(String(minStockLevel), 10) : null,
        reorderLevel: reorderLevel !== undefined && reorderLevel !== '' ? parseInt(String(reorderLevel), 10) : null,
        maxStockLevel: maxStockLevel !== undefined && maxStockLevel !== '' ? parseInt(String(maxStockLevel), 10) : null,
        reorderQuantity: reorderQuantity !== undefined && reorderQuantity !== '' ? parseInt(String(reorderQuantity), 10) : null,
        primarySupplierId: primarySupplierId || null,
        barcode: barcode?.trim() || null,
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
    console.error('Products POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

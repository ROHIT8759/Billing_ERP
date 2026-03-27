import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountType, VoucherType } from '@prisma/client'
import {
  ensureAccountingSetup,
  ensureCustomerAccount,
  getSystemAccount,
  postJournalEntry,
} from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

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
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const body = await request.json()
    const {
      customerId,
      items,
      subtotal,
      discountAmount,
      discountType,
      totalAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
    } = body

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
    const invoice = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, shopId: true },
      })

      if (!customer || customer.shopId !== shop.id) {
        throw new Error('Customer not found')
      }

      const salesAccount = await getSystemAccount(tx, shop.id, AccountType.SALES)

      const newInvoice = await tx.invoice.create({
        data: {
          shopId: shop.id,
          customerId,
          invoiceNo,
          subtotal: parseFloat(subtotal || totalAmount),
          discountAmount: parseFloat(discountAmount || 0),
          discountType: discountType || 'none',
          totalAmount: parseFloat(totalAmount),
          gstAmount: parseFloat(gstAmount || 0),
          cgstAmount: parseFloat(cgstAmount || 0),
          sgstAmount: parseFloat(sgstAmount || 0),
          igstAmount: parseFloat(igstAmount || 0),
          status: 'paid',
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: parseInt(item.quantity, 10),
              price: parseFloat(item.price),
              discountPct: parseFloat(item.discountPct || 0),
              hsnCode: item.hsnCode || null,
              taxRate: parseFloat(item.taxRate || 18),
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

      const refreshedCustomerAccount = await ensureCustomerAccount(
        tx,
        shop.id,
        newInvoice.customerId,
        newInvoice.customer.name
      )

      await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.SALES,
        entryDate: newInvoice.createdAt,
        reference: newInvoice.invoiceNo,
        narration: `Sales invoice for ${newInvoice.customer.name}`,
        sourceModel: 'Invoice',
        sourceId: newInvoice.id,
        lines: [
          {
            accountId: refreshedCustomerAccount.id,
            debit: Number(newInvoice.totalAmount),
          },
          {
            accountId: salesAccount.id,
            credit: Number(newInvoice.totalAmount),
          },
        ],
      })

      return newInvoice
    })

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Invoice creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

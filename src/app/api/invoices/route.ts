import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountType, VoucherType } from '@prisma/client'
import {
  ensureAccountingSetup,
  ensureCustomerAccount,
  createInvoiceAllocation,
  getSystemAccount,
  postJournalEntry,
  recomputeInvoicePaymentState,
} from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

type InvoiceCreateItemInput = {
  productId: string
  quantity: number | string
  price: number | string
  discountPct?: number | string
  hsnCode?: string | null
  taxRate?: number | string
}

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
  } catch {
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
      dueDate,
      paymentTermDays,
      initialPaymentAmount,
      paymentMode,
    } = body

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer and at least one item are required' }, { status: 400 })
    }

    const createdDate = new Date()
    const totalAmountValue = Number.parseFloat(totalAmount)
    const initialPaymentAmountValue = Number.parseFloat(initialPaymentAmount || 0)
    const paymentTermDaysValue = Number.parseInt(paymentTermDays, 10)

    if (!Number.isFinite(totalAmountValue) || totalAmountValue <= 0) {
      return NextResponse.json({ error: 'A valid total amount is required' }, { status: 400 })
    }

    if (!Number.isFinite(initialPaymentAmountValue) || initialPaymentAmountValue < 0) {
      return NextResponse.json({ error: 'Initial payment amount must be zero or greater' }, { status: 400 })
    }

    if (initialPaymentAmountValue > totalAmountValue) {
      return NextResponse.json(
        { error: 'Initial payment amount cannot exceed total amount' },
        { status: 400 }
      )
    }

    let computedDueDate: Date | null = null
    if (dueDate) {
      const parsedDueDate = new Date(dueDate)
      if (Number.isNaN(parsedDueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
      }
      computedDueDate = parsedDueDate
    } else if (Number.isFinite(paymentTermDaysValue) && paymentTermDaysValue > 0) {
      computedDueDate = new Date(createdDate)
      computedDueDate.setDate(computedDueDate.getDate() + paymentTermDaysValue)
    }

    // Generate Invoice Number (Format: INV-YYYYMMDD-XXXX)
    const dateStr = `${createdDate.getFullYear()}${(createdDate.getMonth() + 1).toString().padStart(2, '0')}${createdDate.getDate().toString().padStart(2, '0')}`
    const startOfDay = new Date(createdDate)
    startOfDay.setHours(0, 0, 0, 0)
    const count = await prisma.invoice.count({
      where: {
        shopId: shop.id,
        createdAt: { gte: startOfDay }
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
      const cashOrBankAccount = initialPaymentAmountValue > 0
        ? await getSystemAccount(
            tx,
            shop.id,
            paymentMode === 'BANK' ? AccountType.BANK : AccountType.CASH
          )
        : null

      const newInvoice = await tx.invoice.create({
        data: {
          shopId: shop.id,
          customerId,
          invoiceNo,
          subtotal: parseFloat(subtotal || totalAmount),
          discountAmount: parseFloat(discountAmount || 0),
          discountType: discountType || 'none',
          totalAmount: totalAmountValue,
          gstAmount: parseFloat(gstAmount || 0),
          cgstAmount: parseFloat(cgstAmount || 0),
          sgstAmount: parseFloat(sgstAmount || 0),
          igstAmount: parseFloat(igstAmount || 0),
          dueDate: computedDueDate,
          paidAmount: 0,
          outstandingAmount: totalAmountValue,
          paymentStatus: 'UNPAID',
          status: 'paid',
          items: {
            create: items.map((item: InvoiceCreateItemInput) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
              price: Number(item.price),
              discountPct: Number(item.discountPct || 0),
              hsnCode: item.hsnCode || null,
              taxRate: Number(item.taxRate || 18),
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

      if (initialPaymentAmountValue > 0 && cashOrBankAccount) {
        const receiptEntry = await postJournalEntry(tx, {
          shopId: shop.id,
          voucherType: VoucherType.RECEIPT,
          entryDate: newInvoice.createdAt,
          reference: newInvoice.invoiceNo,
          narration: `Receipt against sales invoice ${newInvoice.invoiceNo} from ${newInvoice.customer.name}`,
          sourceModel: 'Invoice',
          sourceId: newInvoice.id,
          lines: [
            {
              accountId: cashOrBankAccount.id,
              debit: initialPaymentAmountValue,
            },
            {
              accountId: refreshedCustomerAccount.id,
              credit: initialPaymentAmountValue,
            },
          ],
        })

        await createInvoiceAllocation(tx, {
          shopId: shop.id,
          invoiceId: newInvoice.id,
          journalEntryId: receiptEntry.id,
          amount: initialPaymentAmountValue,
          allocatedAt: newInvoice.createdAt,
        })

        await recomputeInvoicePaymentState(tx, newInvoice.id)
      }

      return tx.invoice.findUniqueOrThrow({
        where: { id: newInvoice.id },
        include: {
          customer: true,
          items: true,
        },
      })
    })

    return NextResponse.json(invoice)
  } catch (error: unknown) {
    console.error('Invoice creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

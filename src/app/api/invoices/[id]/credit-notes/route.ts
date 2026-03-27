import { NextRequest, NextResponse } from 'next/server'
import { AccountType, VoucherType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import {
  createInvoiceAllocation,
  ensureCustomerAccount,
  getSystemAccount,
  postJournalEntry,
  recomputeInvoicePaymentState,
} from '@/lib/accounting'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function nextCreditNoteNo(shopId: string) {
  const count = await prisma.salesReturn.count({ where: { shopId } })
  return `CRN-${String(count + 1).padStart(5, '0')}`
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const notes = await prisma.salesReturn.findMany({
      where: { shopId: shop.id, invoiceId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Credit note fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { items, reason, entryDate, reference } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one return item is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, shopId: shop.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      const customerAccount = await ensureCustomerAccount(
        tx,
        shop.id,
        invoice.customer.id,
        invoice.customer.name
      )
      const salesReturnAccount = await getSystemAccount(tx, shop.id, AccountType.SALES_RETURN)
      const effectiveEntryDate = entryDate ? new Date(entryDate) : new Date()

      const preparedItems = []
      let totalAmount = 0

      for (const inputItem of items as Array<{ invoiceItemId: string; quantity: number | string }>) {
        const invoiceItem = invoice.items.find((item) => item.id === inputItem.invoiceItemId)
        if (!invoiceItem) {
          throw new Error('Invoice item not found')
        }

        const quantity = Number(inputItem.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Return quantity must be greater than zero')
        }

        const existingReturns = await tx.salesReturnItem.aggregate({
          where: {
            invoiceItemId: invoiceItem.id,
            salesReturn: {
              shopId: shop.id,
            },
          },
          _sum: {
            quantity: true,
          },
        })

        const alreadyReturned = Number(existingReturns._sum.quantity || 0)
        const availableToReturn = invoiceItem.quantity - alreadyReturned
        if (quantity > availableToReturn) {
          throw new Error(`Return quantity exceeds available quantity for ${invoiceItem.product.name}`)
        }

        const amount = Number((invoiceItem.price * quantity).toFixed(2))
        totalAmount += amount
        preparedItems.push({
          invoiceItemId: invoiceItem.id,
          productId: invoiceItem.productId,
          quantity,
          rate: invoiceItem.price,
          amount,
        })
      }

      if (totalAmount > invoice.outstandingAmount) {
        throw new Error('Credit note amount cannot exceed current outstanding balance')
      }

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.CREDIT_NOTE,
        entryDate: effectiveEntryDate,
        reference: reference || invoice.invoiceNo || null,
        narration: reason || `Credit note against invoice ${invoice.invoiceNo || invoice.id}`,
        sourceModel: 'Invoice',
        sourceId: invoice.id,
        lines: [
          { accountId: salesReturnAccount.id, debit: totalAmount },
          { accountId: customerAccount.id, credit: totalAmount },
        ],
      })

      const note = await tx.salesReturn.create({
        data: {
          shopId: shop.id,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          journalEntryId: journalEntry.id,
          noteNo: await nextCreditNoteNo(shop.id),
          reason: reason || null,
          totalAmount,
          createdAt: effectiveEntryDate,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
        },
      })

      for (const item of preparedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }

      await createInvoiceAllocation(tx, {
        shopId: shop.id,
        invoiceId: invoice.id,
        journalEntryId: journalEntry.id,
        amount: totalAmount,
        allocatedAt: effectiveEntryDate,
      })

      const updatedInvoice = await recomputeInvoicePaymentState(tx, invoice.id)

      return { note, journalEntry, invoice: updatedInvoice }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Credit note creation error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

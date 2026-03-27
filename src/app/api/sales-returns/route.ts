import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { AccountType, VoucherType } from '@prisma/client'
import {
  createInvoiceAllocation,
  ensureAccountingSetup,
  ensureCustomerAccount,
  getSystemAccount,
  postJournalEntry,
  recomputeInvoicePaymentState,
} from '@/lib/accounting'

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const salesReturns = await prisma.salesReturn.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        invoice: true,
        items: true,
      },
    })

    return NextResponse.json(salesReturns)
  } catch (error: any) {
    console.error('Fetch sales returns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const body = await request.json()
    const { invoiceId, items, reason, totalAmount } = body

    if (!invoiceId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invoice ID and at least one item are required' }, { status: 400 })
    }

    const numericTotal = Number(totalAmount || 0)
    if (numericTotal <= 0) {
      return NextResponse.json({ error: 'Total amount must be greater than zero' }, { status: 400 })
    }

    // Generate Note Number
    const count = await prisma.salesReturn.count({ where: { shopId: shop.id } })
    const noteNo = `SR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId, shopId: shop.id },
        include: { customer: true },
      })

      if (!invoice) throw new Error('Invoice not found')

      // Create the Return Record
      const salesReturn = await tx.salesReturn.create({
        data: {
          shopId: shop.id,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          noteNo,
          reason: reason || null,
          totalAmount: numericTotal,
          items: {
            create: items.map((item: any) => ({
              invoiceItemId: item.invoiceItemId || null,
              productId: item.productId,
              quantity: Number(item.quantity),
              rate: Number(item.rate),
              amount: Number(item.amount),
            })),
          },
        },
        include: { items: true },
      })

      // Increment inventory appropriately
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: Number(item.quantity) } },
          })
        }
      }

      // Accounting
      const customerAccount = await ensureCustomerAccount(
        tx,
        shop.id,
        invoice.customer.id,
        invoice.customer.name
      )
      const salesReturnAccount = await getSystemAccount(tx, shop.id, AccountType.SALES_RETURN)

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.CREDIT_NOTE,
        reference: noteNo,
        narration: `Sales Return against Invoice ${invoice.invoiceNo}`,
        sourceModel: 'SalesReturn',
        sourceId: salesReturn.id,
        lines: [
          { accountId: salesReturnAccount.id, debit: numericTotal },
          { accountId: customerAccount.id, credit: numericTotal },
        ],
      })

      await tx.salesReturn.update({
        where: { id: salesReturn.id },
        data: { journalEntryId: journalEntry.id },
      })

      // Allocate the credit note against the invoice's outstanding balance
      await createInvoiceAllocation(tx, {
        shopId: shop.id,
        invoiceId: invoice.id,
        journalEntryId: journalEntry.id,
        amount: numericTotal,
      })

      await recomputeInvoicePaymentState(tx, invoice.id)

      return salesReturn
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Create sales return error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

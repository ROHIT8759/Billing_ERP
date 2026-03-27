import { NextRequest, NextResponse } from 'next/server'
import { differenceInCalendarDays, isValid, parseISO, startOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

const REPORT_TYPES = ['receivables', 'payables'] as const
type ReportType = typeof REPORT_TYPES[number]
type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '91_plus'

type AgingSummary = {
  count: number
  amount: number
}

function parseReportType(value: string | null): ReportType | null {
  if (!value) return null
  return REPORT_TYPES.includes(value as ReportType) ? (value as ReportType) : null
}

function parseAsOf(value: string | null): Date | null {
  if (!value) return startOfDay(new Date())

  const parsed = parseISO(value)
  if (!isValid(parsed)) return null

  return startOfDay(parsed)
}

function getBucket(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return 'current'
  if (daysPastDue <= 30) return '1_30'
  if (daysPastDue <= 60) return '31_60'
  if (daysPastDue <= 90) return '61_90'
  return '91_plus'
}

function getDaysPastDue(asOf: Date, dueDate: Date | null): number {
  if (!dueDate) return 0
  return Math.max(differenceInCalendarDays(asOf, startOfDay(dueDate)), 0)
}

function createEmptyBucketSummary(): Record<AgingBucket, AgingSummary> {
  return {
    current: { count: 0, amount: 0 },
    '1_30': { count: 0, amount: 0 },
    '31_60': { count: 0, amount: 0 },
    '61_90': { count: 0, amount: 0 },
    '91_plus': { count: 0, amount: 0 },
  }
}

function addToBucketSummary(
  bucketSummary: Record<AgingBucket, AgingSummary>,
  bucket: AgingBucket,
  amount: number
) {
  bucketSummary[bucket].count += 1
  bucketSummary[bucket].amount += amount
}

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const reportType = parseReportType(request.nextUrl.searchParams.get('type'))
    if (!reportType) {
      return NextResponse.json(
        { error: 'Invalid type. Expected receivables or payables' },
        { status: 400 }
      )
    }

    const asOf = parseAsOf(request.nextUrl.searchParams.get('asOf'))
    if (!asOf) {
      return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 })
    }

    const bucketSummary = createEmptyBucketSummary()
    let totalOutstanding = 0

    if (reportType === 'receivables') {
      const invoices = await prisma.invoice.findMany({
        where: {
          shopId: shop.id,
          outstandingAmount: { gt: 0 },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          invoiceNo: true,
          createdAt: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          paymentStatus: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      })

      const rows = invoices.map((invoice) => {
        const daysPastDue = getDaysPastDue(asOf, invoice.dueDate)
        const bucket = invoice.dueDate ? getBucket(daysPastDue) : 'current'
        const outstandingAmount = Number(invoice.outstandingAmount)

        addToBucketSummary(bucketSummary, bucket, outstandingAmount)
        totalOutstanding += outstandingAmount

        return {
          id: invoice.id,
          bucket,
          daysPastDue,
          document: {
            id: invoice.id,
            type: 'invoice',
            number: invoice.invoiceNo,
            date: invoice.createdAt,
            dueDate: invoice.dueDate,
            totalAmount: invoice.totalAmount,
            paidAmount: invoice.paidAmount,
            outstandingAmount,
            paymentStatus: invoice.paymentStatus,
          },
          party: {
            id: invoice.customer.id,
            type: 'customer',
            name: invoice.customer.name,
            phone: invoice.customer.phone,
            email: invoice.customer.email,
          },
        }
      })

      return NextResponse.json({
        summary: {
          type: reportType,
          asOf,
          count: rows.length,
          totalOutstanding,
          buckets: bucketSummary,
        },
        rows,
      })
    }

    const purchases = await prisma.purchase.findMany({
      where: {
        shopId: shop.id,
        outstandingAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        billNo: true,
        vendorName: true,
        createdAt: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        paymentStatus: true,
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    const rows = purchases.map((purchase) => {
      const daysPastDue = getDaysPastDue(asOf, purchase.dueDate)
      const bucket = purchase.dueDate ? getBucket(daysPastDue) : 'current'
      const outstandingAmount = Number(purchase.outstandingAmount)

      addToBucketSummary(bucketSummary, bucket, outstandingAmount)
      totalOutstanding += outstandingAmount

      return {
        id: purchase.id,
        bucket,
        daysPastDue,
        document: {
          id: purchase.id,
          type: 'purchase',
          number: purchase.billNo,
          date: purchase.createdAt,
          dueDate: purchase.dueDate,
          totalAmount: purchase.totalAmount,
          paidAmount: purchase.paidAmount,
          outstandingAmount,
          paymentStatus: purchase.paymentStatus,
        },
        party: {
          id: purchase.supplier?.id ?? null,
          type: 'supplier',
          name: purchase.supplier?.name ?? purchase.vendorName,
          phone: purchase.supplier?.phone ?? null,
          email: purchase.supplier?.email ?? null,
        },
      }
    })

    return NextResponse.json({
      summary: {
        type: reportType,
        asOf,
        count: rows.length,
        totalOutstanding,
        buckets: bucketSummary,
      },
      rows,
    })
  } catch (error) {
    console.error('Aging report API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

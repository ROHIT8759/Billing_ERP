import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { startOfDay, endOfDay, isValid, parseISO } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const dateParam = request.nextUrl.searchParams.get('date')
    let targetDate = new Date()
    
    if (dateParam) {
      const parsed = parseISO(dateParam)
      if (isValid(parsed)) targetDate = parsed
    }

    const start = startOfDay(targetDate)
    const end = endOfDay(targetDate)

    const entries = await prisma.journalEntry.findMany({
      where: {
        shopId: shop.id,
        entryDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { entryDate: 'asc' },
      include: {
        lines: {
          include: {
            account: { select: { name: true, type: true } }
          },
          orderBy: { debit: 'desc' } // Debits first
        }
      }
    })

    return NextResponse.json(entries)
  } catch (error: any) {
    console.error('Day Book API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

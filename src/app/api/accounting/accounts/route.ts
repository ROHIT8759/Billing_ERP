import { NextResponse } from 'next/server'
import { AccountCategory, AccountType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

async function nextManualCode(shopId: string) {
  const accounts = await prisma.account.findMany({
    where: { shopId },
    select: { code: true },
  })

  const maxNumeric = accounts.reduce((max, account) => {
    const value = Number.parseInt(account.code, 10)
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 6999)

  return String(maxNumeric + 1)
}

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const [accounts, groupedLines] = await Promise.all([
      prisma.account.findMany({
        where: { shopId: shop.id },
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
      prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          account: {
            shopId: shop.id,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      }),
    ])

    const balances = new Map(
      groupedLines.map((line) => [
        line.accountId,
        {
          debit: Number(line._sum.debit || 0),
          credit: Number(line._sum.credit || 0),
        },
      ])
    )

    const payload = accounts.map((account) => {
      const totals = balances.get(account.id) || { debit: 0, credit: 0 }
      const balance =
        account.category === AccountCategory.ASSET || account.category === AccountCategory.EXPENSE
          ? account.openingBalance + totals.debit - totals.credit
          : account.openingBalance + totals.credit - totals.debit

      return {
        ...account,
        totals,
        balance,
      }
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Accounts fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { name, category, type, openingBalance } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
    }

    const account = await prisma.account.create({
      data: {
        shopId: shop.id,
        code: await nextManualCode(shop.id),
        name,
        category: category as AccountCategory,
        type: (type as AccountType) || AccountType.GENERAL,
        openingBalance: Number(openingBalance || 0),
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Account creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

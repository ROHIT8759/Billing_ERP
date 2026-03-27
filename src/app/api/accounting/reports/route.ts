import { NextResponse } from 'next/server'
import { AccountCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

function getAccountBalance(
  category: AccountCategory,
  openingBalance: number,
  debit: number,
  credit: number
) {
  if (category === AccountCategory.ASSET || category === AccountCategory.EXPENSE) {
    return openingBalance + debit - credit
  }

  return openingBalance + credit - debit
}

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const [accounts, groupedLines] = await Promise.all([
      prisma.account.findMany({
        where: { shopId: shop.id, isActive: true },
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

    const groupedMap = new Map(
      groupedLines.map((line) => [
        line.accountId,
        {
          debit: Number(line._sum.debit || 0),
          credit: Number(line._sum.credit || 0),
        },
      ])
    )

    const trialBalance = accounts.map((account) => {
      const totals = groupedMap.get(account.id) || { debit: 0, credit: 0 }
      const balance = getAccountBalance(
        account.category,
        Number(account.openingBalance),
        totals.debit,
        totals.credit
      )

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        category: account.category,
        debit: balance > 0 && (account.category === AccountCategory.ASSET || account.category === AccountCategory.EXPENSE)
          ? balance
          : balance < 0 &&
              account.category !== AccountCategory.ASSET &&
              account.category !== AccountCategory.EXPENSE
            ? Math.abs(balance)
            : 0,
        credit: balance > 0 && account.category !== AccountCategory.ASSET && account.category !== AccountCategory.EXPENSE
          ? balance
          : balance < 0 &&
              (account.category === AccountCategory.ASSET || account.category === AccountCategory.EXPENSE)
            ? Math.abs(balance)
            : 0,
        balance,
      }
    })

    const profitLoss = {
      income: trialBalance
        .filter((account) => account.category === AccountCategory.INCOME)
        .reduce((sum, account) => sum + account.balance, 0),
      expenses: trialBalance
        .filter((account) => account.category === AccountCategory.EXPENSE)
        .reduce((sum, account) => sum + account.balance, 0),
    }

    const netProfit = profitLoss.income - profitLoss.expenses

    const assets = trialBalance.filter((account) => account.category === AccountCategory.ASSET)
    const liabilities = trialBalance.filter((account) => account.category === AccountCategory.LIABILITY)
    const equity = trialBalance.filter((account) => account.category === AccountCategory.EQUITY)

    const totalAssets = assets.reduce((sum, account) => sum + account.balance, 0)
    const totalLiabilities = liabilities.reduce((sum, account) => sum + account.balance, 0)
    const totalEquity = equity.reduce((sum, account) => sum + account.balance, 0) + netProfit

    return NextResponse.json({
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        receivables: assets
          .filter((account) => account.name.includes('(Debtor)') || account.code === '1100')
          .reduce((sum, account) => sum + account.balance, 0),
        payables: liabilities
          .filter((account) => account.name.includes('(Creditor)') || account.code === '2000')
          .reduce((sum, account) => sum + account.balance, 0),
        netProfit,
      },
      trialBalance,
      profitLoss: {
        ...profitLoss,
        netProfit,
      },
      balanceSheet: {
        assets,
        liabilities,
        equity: [
          ...equity,
          {
            id: 'net-profit',
            code: 'P&L',
            name: 'Current Year Profit',
            category: AccountCategory.EQUITY,
            debit: 0,
            credit: netProfit > 0 ? netProfit : 0,
            balance: netProfit,
          },
        ],
        totalAssets,
        totalLiabilities,
        totalEquity,
      },
    })
  } catch (error) {
    console.error('Reports fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

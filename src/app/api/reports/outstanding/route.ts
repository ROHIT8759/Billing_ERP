import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'

const AccountType = {
  CASH: 'CASH',
  BANK: 'BANK',
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  SALES: 'SALES',
  PURCHASE: 'PURCHASE',
  EXPENSE: 'EXPENSE',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  EQUITY: 'EQUITY',
  GENERAL: 'GENERAL',
} as const
type AccountType = typeof AccountType[keyof typeof AccountType]

export async function GET(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const accounts = await prisma.account.findMany({
      where: {
        shopId: shop.id,
        type: { in: [AccountType.CUSTOMER, AccountType.SUPPLIER] }
      },
      include: {
        customer: { select: { name: true, phone: true } },
        supplier: { select: { name: true, phone: true } },
        journalLines: { select: { debit: true, credit: true } }
      }
    })

    const transformed = accounts.map((acc: any) => {
      let totalDebit = 0
      let totalCredit = 0
      for (const line of acc.journalLines) {
        totalDebit += line.debit
        totalCredit += line.credit
      }

      let balance = 0
      if (acc.type === AccountType.CUSTOMER) {
        // Customers are Assets: normal balance is Debit
        balance = acc.openingBalance + totalDebit - totalCredit
      } else {
        // Suppliers are Liabilities: normal balance is Credit
        balance = acc.openingBalance + totalCredit - totalDebit
      }

      const partyName = acc.customer?.name || acc.supplier?.name || acc.name
      const partyPhone = acc.customer?.phone || acc.supplier?.phone || null

      return {
        id: acc.id,
        partyType: acc.type,
        partyName,
        partyPhone,
        totalDebit,
        totalCredit,
        netBalance: balance
      }
    })

    // Filter out zero balances, then sort by highest balance
    const filtered = transformed
      .filter((a: any) => Math.abs(a.netBalance) > 0.01)
      .sort((a: any, b: any) => b.netBalance - a.netBalance)

    return NextResponse.json(filtered)
  } catch (error: any) {
    console.error('Outstanding API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

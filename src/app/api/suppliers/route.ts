import { NextResponse } from 'next/server'
import { AccountCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureAccountingSetup, ensureSupplierAccount } from '@/lib/accounting'
import { getApiUserAndShop } from '@/lib/api-auth'

function getLiabilityBalance(openingBalance: number, debit: number, credit: number) {
  return openingBalance + credit - debit
}

export async function GET() {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    await ensureAccountingSetup(shop.id)

    const suppliers = await prisma.supplier.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        account: true,
        purchases: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            vendorName: true,
          },
        },
      },
    })

    const accountIds = suppliers
      .map((supplier) => supplier.accountId)
      .filter((accountId): accountId is string => Boolean(accountId))

    const groupedLines =
      accountIds.length === 0
        ? []
        : await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
              accountId: { in: accountIds },
            },
            _sum: {
              debit: true,
              credit: true,
            },
          })

    const balances = new Map(
      groupedLines.map((line) => [
        line.accountId,
        {
          debit: Number(line._sum.debit || 0),
          credit: Number(line._sum.credit || 0),
        },
      ])
    )

    const payload = suppliers.map((supplier) => {
      const totals = supplier.accountId
        ? balances.get(supplier.accountId) || { debit: 0, credit: 0 }
        : { debit: 0, credit: 0 }

      const outstandingBalance = supplier.account
        ? getLiabilityBalance(
            Number(supplier.account.openingBalance || 0),
            totals.debit,
            totals.credit
          )
        : 0

      const totalPurchases = supplier.purchases.reduce(
        (sum, purchase) => sum + Number(purchase.totalAmount || 0),
        0
      )

      return {
        ...supplier,
        outstandingBalance,
        totalPurchases,
        lastPurchaseAt: supplier.purchases[0]?.createdAt || null,
        purchaseCount: supplier.purchases.length,
      }
    })

    const summary = payload.reduce(
      (acc, supplier) => {
        acc.totalSuppliers += 1
        acc.totalPayables += supplier.outstandingBalance
        acc.totalPurchases += supplier.totalPurchases
        if (supplier.outstandingBalance > 0) acc.suppliersWithDues += 1
        return acc
      },
      {
        totalSuppliers: 0,
        totalPayables: 0,
        totalPurchases: 0,
        suppliersWithDues: 0,
      }
    )

    return NextResponse.json({
      summary,
      suppliers: payload,
    })
  } catch (error) {
    console.error('Suppliers fetch error:', error)
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
    const { name, phone, email, address, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const newSupplier = await tx.supplier.create({
        data: {
          shopId: shop.id,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      })

      const account = await ensureSupplierAccount(tx, shop.id, newSupplier.id, newSupplier.name)

      if (openingBalance && Number(openingBalance) > 0) {
        await tx.account.update({
          where: { id: account.id },
          data: {
            openingBalance: Number(openingBalance),
            category: AccountCategory.LIABILITY,
          },
        })
      }

      return tx.supplier.findUnique({
        where: { id: newSupplier.id },
        include: {
          account: true,
          purchases: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              totalAmount: true,
              createdAt: true,
              vendorName: true,
            },
          },
        },
      })
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { AccountType, VoucherType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getApiUserAndShop } from '@/lib/api-auth'
import { getSystemAccount, postJournalEntry } from '@/lib/accounting'

async function nextWriteOffNo(shopId: string) {
  const count = await prisma.stockWriteOff.count({ where: { shopId } })
  return `WOF-${String(count + 1).padStart(5, '0')}`
}

export async function GET(_request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const writeOffs = await prisma.stockWriteOff.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
      },
    })

    return NextResponse.json(writeOffs)
  } catch (error) {
    console.error('Write-off fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, shop } = await getApiUserAndShop()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const body = await request.json()
    const { reason, notes, items, entryDate, referenceNo } = body

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one write-off item is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const effectiveEntryDate = entryDate ? new Date(entryDate) : new Date()
      const writeOffAccount = await getSystemAccount(tx, shop.id, AccountType.STOCK_WRITE_OFF)
      const inventoryAccount = await getSystemAccount(tx, shop.id, AccountType.INVENTORY)
      const preparedItems = []
      let totalAmount = 0

      for (const inputItem of items as Array<{
        productId?: string
        batchId?: string
        quantity: number | string
        unitCost?: number | string
      }>) {
        const quantity = Number(inputItem.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Write-off quantity must be greater than zero')
        }

        let product = null
        let batch = null

        if (inputItem.batchId) {
          batch = await tx.batch.findUnique({
            where: { id: inputItem.batchId },
            include: { product: true },
          })

          if (!batch || batch.shopId !== shop.id) {
            throw new Error('Batch not found')
          }

          if (quantity > batch.quantity) {
            throw new Error(`Write-off quantity exceeds available stock for ${batch.product.name}`)
          }

          product = batch.product
        } else if (inputItem.productId) {
          product = await tx.product.findUnique({
            where: { id: inputItem.productId },
          })

          if (!product || product.shopId !== shop.id) {
            throw new Error('Product not found')
          }

          if (quantity > product.stock) {
            throw new Error(`Write-off quantity exceeds available stock for ${product.name}`)
          }
        } else {
          throw new Error('Each write-off item requires a product or batch')
        }

        const unitCost = Number(inputItem.unitCost || product.price || 0)
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error('Unit cost must be zero or greater')
        }

        const amount = Number((unitCost * quantity).toFixed(2))
        totalAmount += amount
        preparedItems.push({
          productId: product.id,
          batchId: batch?.id || null,
          quantity,
          unitCost,
          amount,
          batchGodownId: batch?.godownId || null,
        })
      }

      const journalEntry = await postJournalEntry(tx, {
        shopId: shop.id,
        voucherType: VoucherType.DEBIT_NOTE,
        entryDate: effectiveEntryDate,
        reference: referenceNo || null,
        narration: notes || `Inventory write-off: ${reason}`,
        sourceModel: 'StockWriteOff',
        lines: [
          { accountId: writeOffAccount.id, debit: totalAmount },
          { accountId: inventoryAccount.id, credit: totalAmount },
        ],
      })

      const writeOff = await tx.stockWriteOff.create({
        data: {
          shopId: shop.id,
          journalEntryId: journalEntry.id,
          referenceNo: referenceNo?.trim() || await nextWriteOffNo(shop.id),
          reason: reason.trim(),
          notes: notes?.trim() || null,
          totalAmount,
          createdAt: effectiveEntryDate,
          items: {
            create: preparedItems.map(({ batchGodownId, ...item }) => item),
          },
        },
        include: {
          items: true,
        },
      })

      for (const item of preparedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        if (item.batchId) {
          await tx.batch.update({
            where: { id: item.batchId },
            data: { quantity: { decrement: item.quantity } },
          })
        }

        if (item.batchGodownId) {
          await tx.godownStock.updateMany({
            where: {
              godownId: item.batchGodownId,
              productId: item.productId,
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          })
        }
      }

      return { writeOff, journalEntry }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Write-off creation error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}




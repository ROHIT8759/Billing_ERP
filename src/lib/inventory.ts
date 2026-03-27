import { AccountType, Prisma, VoucherType } from '@prisma/client'
import { getSystemAccount, postJournalEntry } from '@/lib/accounting'
import { prisma } from '@/lib/prisma'

type Tx = Prisma.TransactionClient | typeof prisma

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeString(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

export async function findProductSubstitutes(
  shopId: string,
  input: { productId?: string | null; saltComposition?: string | null }
) {
  const composition = input.saltComposition
    ? normalizeString(input.saltComposition)
    : input.productId
      ? normalizeString(
          (
            await prisma.product.findUnique({
              where: { id: input.productId },
              select: { saltComposition: true },
            })
          )?.saltComposition
        )
      : null

  if (!composition) return []

  const products = await prisma.product.findMany({
    where: {
      shopId,
      saltComposition: {
        equals: composition,
        mode: 'insensitive',
      },
      ...(input.productId ? { id: { not: input.productId } } : {}),
    },
    orderBy: [
      { stock: 'desc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      stock: true,
      price: true,
      saltComposition: true,
      category: true,
    },
  })

  return products.filter((product) => product.stock > 0)
}

export async function getLowStockProducts(shopId: string) {
  const products = await prisma.product.findMany({
    where: {
      shopId,
      reorderLevel: { not: null },
    },
    include: {
      primarySupplier: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: [
      { stock: 'asc' },
      { name: 'asc' },
    ],
  })

  return products.filter((product) => product.reorderLevel != null && product.stock <= product.reorderLevel)
}

function getReorderQuantity(product: {
  stock: number
  reorderLevel: number | null
  reorderQuantity: number | null
  maxStockLevel: number | null
}) {
  if (product.reorderQuantity && product.reorderQuantity > 0) {
    return product.reorderQuantity
  }

  if (product.maxStockLevel != null) {
    return Math.max(product.maxStockLevel - product.stock, 1)
  }

  if (product.reorderLevel != null) {
    return Math.max(product.reorderLevel - product.stock + 1, 1)
  }

  return 1
}

async function nextPoNumber(tx: Tx, shopId: string) {
  const count = await tx.purchaseOrder.count({ where: { shopId } })
  return `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`
}

export async function ensureDraftPurchaseOrdersForLowStock(
  tx: Tx,
  shopId: string,
  productIds?: string[]
) {
  const lowStockProducts = await tx.product.findMany({
    where: {
      shopId,
      reorderLevel: { not: null },
      ...(productIds?.length ? { id: { in: productIds } } : {}),
    },
    include: {
      primarySupplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const candidates = lowStockProducts.filter((product) => {
    if (product.reorderLevel == null) return false
    if (product.stock > product.reorderLevel) return false
    return Boolean(product.primarySupplierId)
  })

  if (candidates.length === 0) return []

  const existingDraftItems = await tx.purchaseOrderItem.findMany({
    where: {
      productId: { in: candidates.map((product) => product.id) },
      purchaseOrder: {
        shopId,
        status: { in: ['draft', 'sent'] },
      },
    },
    select: {
      productId: true,
    },
  })

  const blockedProductIds = new Set(
    existingDraftItems
      .map((item) => item.productId)
      .filter((productId): productId is string => Boolean(productId))
  )

  const grouped = new Map<string, typeof candidates>()
  for (const product of candidates) {
    if (!product.primarySupplierId || blockedProductIds.has(product.id)) continue
    const list = grouped.get(product.primarySupplierId) || []
    list.push(product)
    grouped.set(product.primarySupplierId, list)
  }

  const createdOrders = []

  for (const [, products] of grouped.entries()) {
    const supplierName = products[0]?.primarySupplier?.name || ''
    const poNumber = await nextPoNumber(tx, shopId)
    const order = await tx.purchaseOrder.create({
      data: {
        shopId,
        poNumber,
        vendorName: supplierName,
        status: 'draft',
        notes: 'Auto-generated from low-stock threshold',
        totalAmount: round2(
          products.reduce(
            (sum, product) => sum + getReorderQuantity(product) * Number(product.price || 0),
            0
          )
        ),
        items: {
          create: products.map((product) => ({
            productId: product.id,
            productName: product.name,
            quantity: getReorderQuantity(product),
            price: Number(product.price || 0),
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    })

    createdOrders.push(order)
  }

  return createdOrders
}

export async function createStockAuditDraft(
  tx: Tx,
  input: { shopId: string; godownId: string; notes?: string | null }
) {
  const products = await tx.product.findMany({
    where: { shopId: input.shopId },
    orderBy: { name: 'asc' },
    include: {
      godownStock: {
        where: { godownId: input.godownId },
        select: { quantity: true },
      },
    },
  })

  const audit = await tx.stockAudit.create({
    data: {
      shopId: input.shopId,
      godownId: input.godownId,
      notes: input.notes || null,
      items: {
        create: products.map((product) => ({
          productId: product.id,
          expectedQty: product.godownStock[0]?.quantity || 0,
          physicalQty: product.godownStock[0]?.quantity || 0,
          differenceQty: 0,
        })),
      },
    },
    include: {
      godown: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              stock: true,
              price: true,
              saltComposition: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })

  return audit
}

export async function postStockAudit(tx: Tx, shopId: string, auditId: string) {
  const audit = await tx.stockAudit.findUnique({
    where: { id: auditId },
    include: {
      godown: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!audit || audit.shopId !== shopId) {
    throw new Error('Stock audit not found')
  }

  if (audit.status === 'posted') {
    throw new Error('Stock audit already posted')
  }

  const changedItems = audit.items.filter((item) => item.differenceQty !== 0)
  const inventoryAccount = await getSystemAccount(tx, shopId, AccountType.INVENTORY)
  const writeOffAccount = await getSystemAccount(tx, shopId, AccountType.STOCK_WRITE_OFF)

  for (const item of changedItems) {
    const existingStock = await tx.godownStock.findUnique({
      where: {
        godownId_productId: {
          godownId: audit.godownId,
          productId: item.productId,
        },
      },
    })

    if (item.physicalQty <= 0) {
      if (existingStock) {
        await tx.godownStock.delete({ where: { id: existingStock.id } })
      }
    } else {
      await tx.godownStock.upsert({
        where: {
          godownId_productId: {
            godownId: audit.godownId,
            productId: item.productId,
          },
        },
        update: { quantity: item.physicalQty },
        create: {
          godownId: audit.godownId,
          productId: item.productId,
          quantity: item.physicalQty,
        },
      })
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        stock: {
          increment: item.differenceQty,
        },
      },
    })

    const amount = round2(Math.abs(item.differenceQty) * Number(item.product.price || 0))
    if (amount > 0) {
      await postJournalEntry(tx, {
        shopId,
        voucherType: VoucherType.OPENING,
        reference: audit.id,
        narration: `Stock audit adjustment for ${item.product.name} at ${audit.godown.name}`,
        sourceModel: 'StockAudit',
        sourceId: audit.id,
        lines: item.differenceQty < 0
          ? [
              { accountId: writeOffAccount.id, debit: amount },
              { accountId: inventoryAccount.id, credit: amount },
            ]
          : [
              { accountId: inventoryAccount.id, debit: amount },
              { accountId: writeOffAccount.id, credit: amount },
            ],
      })
    }
  }

  return tx.stockAudit.update({
    where: { id: audit.id },
    data: {
      status: 'posted',
      postedAt: new Date(),
    },
    include: {
      godown: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              stock: true,
              price: true,
              saltComposition: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })
}


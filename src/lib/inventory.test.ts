import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureDraftPurchaseOrdersForLowStock, postStockAudit } from './inventory'

const { getSystemAccountMock, postJournalEntryMock } = vi.hoisted(() => ({
  getSystemAccountMock: vi.fn(),
  postJournalEntryMock: vi.fn(),
}))

vi.mock('@/lib/accounting', () => ({
  getSystemAccount: getSystemAccountMock,
  postJournalEntry: postJournalEntryMock,
}))

describe('inventory helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ensureDraftPurchaseOrdersForLowStock returns empty when no candidates', async () => {
    const tx = {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      purchaseOrderItem: { findMany: vi.fn().mockResolvedValue([]) },
      purchaseOrder: { count: vi.fn(), create: vi.fn() },
    }

    const out = await ensureDraftPurchaseOrdersForLowStock(tx as any, 'shop1')
    expect(out).toEqual([])
  })

  it('ensureDraftPurchaseOrdersForLowStock groups by supplier and skips blocked products', async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p1', name: 'A', stock: 2, reorderLevel: 5, reorderQuantity: 3, maxStockLevel: null,
            primarySupplierId: 's1', primarySupplier: { name: 'Supplier One' }, price: 10,
          },
          {
            id: 'p2', name: 'B', stock: 1, reorderLevel: 4, reorderQuantity: 5, maxStockLevel: null,
            primarySupplierId: 's1', primarySupplier: { name: 'Supplier One' }, price: 20,
          },
          {
            id: 'p3', name: 'C', stock: 0, reorderLevel: 1, reorderQuantity: 2, maxStockLevel: null,
            primarySupplierId: 's2', primarySupplier: { name: 'Supplier Two' }, price: 15,
          },
        ]),
      },
      purchaseOrderItem: {
        findMany: vi.fn().mockResolvedValue([{ productId: 'p2' }]),
      },
      purchaseOrder: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn()
          .mockResolvedValueOnce({ id: 'po1', items: [{ productId: 'p1' }] })
          .mockResolvedValueOnce({ id: 'po2', items: [{ productId: 'p3' }] }),
      },
    }

    const out = await ensureDraftPurchaseOrdersForLowStock(tx as any, 'shop1')

    expect(out).toHaveLength(2)
    expect(tx.purchaseOrder.create).toHaveBeenCalledTimes(2)
    const firstCall = (tx.purchaseOrder.create as any).mock.calls[0][0]
    expect(firstCall.data.vendorName).toBe('Supplier One')
    expect(firstCall.data.items.create).toHaveLength(1)
    expect(firstCall.data.items.create[0].productId).toBe('p1')
  })

  it('postStockAudit throws when audit is missing', async () => {
    const tx = {
      stockAudit: { findUnique: vi.fn().mockResolvedValue(null) },
    }

    await expect(postStockAudit(tx as any, 'shop1', 'audit1')).rejects.toThrow('Stock audit not found')
  })

  it('postStockAudit throws when audit is already posted', async () => {
    const tx = {
      stockAudit: {
        findUnique: vi.fn().mockResolvedValue({ id: 'audit1', shopId: 'shop1', status: 'posted', items: [] }),
      },
    }

    await expect(postStockAudit(tx as any, 'shop1', 'audit1')).rejects.toThrow('Stock audit already posted')
  })

  it('postStockAudit updates stock and posts accounting entries for differences', async () => {
    getSystemAccountMock.mockImplementation(async (_tx, _shopId, type: string) => {
      if (type === 'INVENTORY') return { id: 'inventory-account' }
      return { id: 'writeoff-account' }
    })

    const tx = {
      stockAudit: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'audit1',
          shopId: 'shop1',
          status: 'draft',
          godownId: 'g1',
          godown: { name: 'Main Godown' },
          items: [
            {
              id: 'i1',
              productId: 'p1',
              physicalQty: 0,
              differenceQty: -2,
              product: { name: 'Product A', price: 50 },
            },
            {
              id: 'i2',
              productId: 'p2',
              physicalQty: 8,
              differenceQty: 3,
              product: { name: 'Product B', price: 20 },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 'audit1', status: 'posted', items: [] }),
      },
      godownStock: {
        findUnique: vi.fn().mockResolvedValue({ id: 'gs1' }),
        delete: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
      product: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    }

    const out = await postStockAudit(tx as any, 'shop1', 'audit1')

    expect(tx.godownStock.delete).toHaveBeenCalledTimes(1)
    expect(tx.godownStock.upsert).toHaveBeenCalledTimes(1)
    expect(tx.product.update).toHaveBeenCalledTimes(2)
    expect(postJournalEntryMock).toHaveBeenCalledTimes(2)
    expect(tx.stockAudit.update).toHaveBeenCalled()
    expect(out).toEqual({ id: 'audit1', status: 'posted', items: [] })
  })
})

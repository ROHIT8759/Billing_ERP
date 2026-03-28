import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const {
  mockGetApiUserAndShop,
  prismaMock,
  ensureAccountingSetupMock,
  ensureSupplierAccountMock,
  findOrCreateSupplierMock,
  getSystemAccountMock,
  postJournalEntryMock,
  createPurchaseAllocationMock,
  recomputePurchasePaymentStateMock,
} = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    purchase: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  ensureAccountingSetupMock: vi.fn(),
  ensureSupplierAccountMock: vi.fn(),
  findOrCreateSupplierMock: vi.fn(),
  getSystemAccountMock: vi.fn(),
  postJournalEntryMock: vi.fn(),
  createPurchaseAllocationMock: vi.fn(),
  recomputePurchasePaymentStateMock: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/accounting', () => ({
  createPurchaseAllocation: createPurchaseAllocationMock,
  ensureAccountingSetup: ensureAccountingSetupMock,
  ensureSupplierAccount: ensureSupplierAccountMock,
  findOrCreateSupplier: findOrCreateSupplierMock,
  getSystemAccount: getSystemAccountMock,
  postJournalEntry: postJournalEntryMock,
  recomputePurchasePaymentState: recomputePurchasePaymentStateMock,
}))

describe('/api/purchases route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAccountingSetupMock.mockResolvedValue(undefined)
  })

  it('GET returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })

    const res = await GET()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('GET returns purchases for authorized shop', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    prismaMock.purchase.findMany.mockResolvedValue([{ id: 'pur1' }])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'pur1' }])
    expect(ensureAccountingSetupMock).toHaveBeenCalledWith('shop1')
  })

  it('POST validates required supplier/vendor and items', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })

    const req = new Request('http://localhost/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Supplier or vendor name and at least one item are required',
    })
  })

  it('POST validates total amount', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })

    const req = new Request('http://localhost/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorName: 'Acme Supplier',
        items: [{ productName: 'Item A', quantity: 1, price: 50 }],
        totalAmount: 0,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'A valid total amount is required' })
  })

  it('POST creates a purchase with vendor name flow', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })

    findOrCreateSupplierMock.mockResolvedValue({
      supplier: { id: 'sup1', name: 'Acme Supplier', shopId: 'shop1' },
      account: { id: 'sup-account' },
    })
    getSystemAccountMock.mockResolvedValue({ id: 'purchase-account' })
    postJournalEntryMock.mockResolvedValue({ id: 'je1' })

    const createdAt = new Date('2026-03-27T10:00:00.000Z')

    const txMock = {
      purchase: {
        create: vi.fn().mockResolvedValue({
          id: 'pur1',
          createdAt,
          totalAmount: 500,
          items: [{ id: 'i1' }],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'pur1',
          vendorName: 'Acme Supplier',
          items: [{ id: 'i1' }],
          supplier: { id: 'sup1', name: 'Acme Supplier' },
        }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    }

    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    const req = new Request('http://localhost/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorName: 'Acme Supplier',
        items: [{ productName: 'Paracetamol', quantity: '2', price: '250' }],
        totalAmount: '500',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ id: 'pur1', vendorName: 'Acme Supplier' })
    )

    expect(postJournalEntryMock).toHaveBeenCalledTimes(1)
    expect(createPurchaseAllocationMock).not.toHaveBeenCalled()
    expect(recomputePurchasePaymentStateMock).not.toHaveBeenCalled()
  })
})

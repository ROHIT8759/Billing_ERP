import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const {
  mockGetApiUserAndShop,
  ensureAccountingSetupMock,
  ensureCustomerAccountMock,
  createInvoiceAllocationMock,
  getSystemAccountMock,
  postJournalEntryMock,
  recomputeInvoicePaymentStateMock,
  ensureDraftPurchaseOrdersForLowStockMock,
  prismaMock,
} = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  ensureAccountingSetupMock: vi.fn(),
  ensureCustomerAccountMock: vi.fn(),
  createInvoiceAllocationMock: vi.fn(),
  getSystemAccountMock: vi.fn(),
  postJournalEntryMock: vi.fn(),
  recomputeInvoicePaymentStateMock: vi.fn(),
  ensureDraftPurchaseOrdersForLowStockMock: vi.fn(),
  prismaMock: {
    invoice: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/accounting', () => ({
  ensureAccountingSetup: ensureAccountingSetupMock,
  ensureCustomerAccount: ensureCustomerAccountMock,
  createInvoiceAllocation: createInvoiceAllocationMock,
  getSystemAccount: getSystemAccountMock,
  postJournalEntry: postJournalEntryMock,
  recomputeInvoicePaymentState: recomputeInvoicePaymentStateMock,
}))

vi.mock('@/lib/inventory', () => ({
  ensureDraftPurchaseOrdersForLowStock: ensureDraftPurchaseOrdersForLowStockMock,
}))

describe('/api/invoices route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAccountingSetupMock.mockResolvedValue(undefined)
  })

  it('GET returns 401 if unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })

    const res = await GET()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('GET returns invoices list for authorized shop', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv1' }])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'inv1' }])
    expect(ensureAccountingSetupMock).toHaveBeenCalledWith('shop1')
  })

  it('POST validates invalid due date', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })

    const req = new Request('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 1, price: 100 }],
        totalAmount: 100,
        dueDate: 'not-a-date',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid due date' })
  })

  it('POST returns stock error when inventory is insufficient', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    prismaMock.invoice.count.mockResolvedValue(0)

    const txMock = {
      customer: {
        findUnique: vi.fn().mockResolvedValue({ id: 'c1', shopId: 'shop1', name: 'Acme Customer' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Dolo', stock: 1 }]),
      },
    }

    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    const req = new Request('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 5, price: 100 }],
        subtotal: 500,
        totalAmount: 500,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Insufficient stock for Dolo' })
  })

  it('POST creates invoice and initial receipt allocation', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    prismaMock.invoice.count.mockResolvedValue(0)

    const createdAt = new Date('2026-03-27T10:00:00.000Z')

    const txMock = {
      customer: {
        findUnique: vi.fn().mockResolvedValue({ id: 'c1', shopId: 'shop1', name: 'Acme Customer' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Dolo', stock: 20 }]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      invoice: {
        create: vi.fn().mockResolvedValue({
          id: 'inv1',
          invoiceNo: 'INV-20260327-0001',
          createdAt,
          totalAmount: 500,
          customerId: 'c1',
          customer: { name: 'Acme Customer' },
          items: [{ id: 'it1' }],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'inv1',
          invoiceNo: 'INV-20260327-0001',
          customer: { id: 'c1', name: 'Acme Customer' },
          items: [{ id: 'it1' }],
        }),
      },
    }

    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    ensureCustomerAccountMock.mockResolvedValue({ id: 'customer-account' })
    getSystemAccountMock
      .mockResolvedValueOnce({ id: 'sales-account' })
      .mockResolvedValueOnce({ id: 'cash-account' })

    postJournalEntryMock
      .mockResolvedValueOnce({ id: 'je-sales' })
      .mockResolvedValueOnce({ id: 'je-receipt' })

    const req = new Request('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 2, price: 250, taxRate: 18 }],
        subtotal: 500,
        totalAmount: 500,
        initialPaymentAmount: 200,
        paymentMode: 'CASH',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ id: 'inv1', invoiceNo: 'INV-20260327-0001' })
    )

    expect(ensureDraftPurchaseOrdersForLowStockMock).toHaveBeenCalledWith(txMock, 'shop1', ['p1'])
    expect(postJournalEntryMock).toHaveBeenCalledTimes(2)
    expect(createInvoiceAllocationMock).toHaveBeenCalledTimes(1)
    expect(recomputeInvoicePaymentStateMock).toHaveBeenCalledWith(txMock, 'inv1')
  })
})

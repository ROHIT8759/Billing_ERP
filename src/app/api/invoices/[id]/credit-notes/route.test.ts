import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const {
  mockGetApiUserAndShop,
  createInvoiceAllocationMock,
  ensureCustomerAccountMock,
  getSystemAccountMock,
  postJournalEntryMock,
  recomputeInvoicePaymentStateMock,
  prismaMock,
} = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  createInvoiceAllocationMock: vi.fn(),
  ensureCustomerAccountMock: vi.fn(),
  getSystemAccountMock: vi.fn(),
  postJournalEntryMock: vi.fn(),
  recomputeInvoicePaymentStateMock: vi.fn(),
  prismaMock: {
    salesReturn: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/accounting', () => ({
  createInvoiceAllocation: createInvoiceAllocationMock,
  ensureCustomerAccount: ensureCustomerAccountMock,
  getSystemAccount: getSystemAccountMock,
  postJournalEntry: postJournalEntryMock,
  recomputeInvoicePaymentState: recomputeInvoicePaymentStateMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/invoices/[id]/credit-notes route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns notes list', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.salesReturn.findMany.mockResolvedValue([{ id: 'n1' }])

    const res = await GET(new Request('http://localhost') as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'n1' }])
  })

  it('POST validates missing items', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'At least one return item is required' })
  })

  it('POST creates credit note and updates invoice lifecycle', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const txMock = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'i1',
          shopId: 's1',
          invoiceNo: 'INV-1',
          outstandingAmount: 200,
          customerId: 'c1',
          customer: { id: 'c1', name: 'Acme' },
          items: [
            {
              id: 'ii1',
              quantity: 5,
              price: 20,
              productId: 'p1',
              product: { id: 'p1', name: 'Dolo' },
            },
          ],
        }),
      },
      salesReturnItem: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 1 } }),
      },
      salesReturn: {
        create: vi.fn().mockResolvedValue({ id: 'sr1', items: [] }),
      },
      product: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    }

    prismaMock.salesReturn.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    ensureCustomerAccountMock.mockResolvedValue({ id: 'cust-acc' })
    getSystemAccountMock.mockResolvedValue({ id: 'sales-return-acc' })
    postJournalEntryMock.mockResolvedValue({ id: 'je1' })
    createInvoiceAllocationMock.mockResolvedValue({ id: 'al1' })
    recomputeInvoicePaymentStateMock.mockResolvedValue({ id: 'i1', paymentStatus: 'PARTIAL' })

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ invoiceItemId: 'ii1', quantity: 2 }],
        reason: 'Damaged strip',
      }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toEqual(expect.objectContaining({
      note: expect.objectContaining({ id: 'sr1' }),
      journalEntry: expect.objectContaining({ id: 'je1' }),
      invoice: expect.objectContaining({ id: 'i1' }),
    }))
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: { stock: { increment: 2 } } })
    )
  })
})

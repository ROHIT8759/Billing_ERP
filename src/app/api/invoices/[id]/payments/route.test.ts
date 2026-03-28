import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const {
  mockGetApiUserAndShop,
  assertAllocationAmountValidMock,
  createInvoiceAllocationMock,
  ensureCustomerAccountMock,
  getSystemAccountMock,
  postJournalEntryMock,
  recomputeInvoicePaymentStateMock,
  prismaMock,
} = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  assertAllocationAmountValidMock: vi.fn(),
  createInvoiceAllocationMock: vi.fn(),
  ensureCustomerAccountMock: vi.fn(),
  getSystemAccountMock: vi.fn(),
  postJournalEntryMock: vi.fn(),
  recomputeInvoicePaymentStateMock: vi.fn(),
  prismaMock: {
    invoiceAllocation: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/accounting', () => ({
  assertAllocationAmountValid: assertAllocationAmountValidMock,
  createInvoiceAllocation: createInvoiceAllocationMock,
  ensureCustomerAccount: ensureCustomerAccountMock,
  getSystemAccount: getSystemAccountMock,
  postJournalEntry: postJournalEntryMock,
  recomputeInvoicePaymentState: recomputeInvoicePaymentStateMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/invoices/[id]/payments route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns allocations for invoice', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.invoiceAllocation.findMany.mockResolvedValue([{ id: 'a1' }])

    const res = await GET(new Request('http://localhost') as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'a1' }])
  })

  it('POST validates voucher type', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10, voucherType: 'SALES' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid voucher type for invoice payment' })
  })

  it('POST records a receipt payment and allocation', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const txMock = {
      invoice: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'i1',
          outstandingAmount: 100,
          customer: { id: 'c1', name: 'Acme' },
          invoiceNo: 'INV-1',
        }),
      },
    }

    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    ensureCustomerAccountMock.mockResolvedValue({ id: 'cust-acc' })
    getSystemAccountMock.mockResolvedValue({ id: 'cash-acc' })
    postJournalEntryMock.mockResolvedValue({ id: 'je1' })
    createInvoiceAllocationMock.mockResolvedValue({ id: 'al1' })
    recomputeInvoicePaymentStateMock.mockResolvedValue({ id: 'i1', paymentStatus: 'PARTIAL' })

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 30, voucherType: 'RECEIPT', paymentMode: 'CASH' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual(expect.objectContaining({
      invoice: expect.objectContaining({ id: 'i1' }),
      journalEntry: expect.objectContaining({ id: 'je1' }),
      allocation: expect.objectContaining({ id: 'al1' }),
    }))
    expect(assertAllocationAmountValidMock).toHaveBeenCalledWith(30, 100)
  })
})

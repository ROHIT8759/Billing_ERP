import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    invoice: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/reports/aging GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid type', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const res = await GET(new NextRequest('http://localhost/api/reports/aging?type=bad'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Invalid type. Expected receivables or payables' })
  })

  it('returns receivables rows and bucket summary', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'i1',
        invoiceNo: 'INV-1',
        createdAt: '2026-03-20T00:00:00.000Z',
        dueDate: new Date('2026-03-25T00:00:00.000Z'),
        totalAmount: 100,
        paidAmount: 20,
        outstandingAmount: 80,
        paymentStatus: 'PARTIAL',
        customer: { id: 'c1', name: 'Acme', phone: '111', email: 'a@a.com' },
      },
    ])

    const res = await GET(new NextRequest('http://localhost/api/reports/aging?type=receivables&asOf=2026-03-27'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.type).toBe('receivables')
    expect(body.summary.totalOutstanding).toBe(80)
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]).toEqual(expect.objectContaining({ bucket: '1_30' }))
  })

  it('returns payables rows', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    prismaMock.purchase.findMany.mockResolvedValue([
      {
        id: 'p1',
        billNo: 'B1',
        vendorName: 'Vendor',
        createdAt: '2026-03-10T00:00:00.000Z',
        dueDate: new Date('2026-03-15T00:00:00.000Z'),
        totalAmount: 200,
        paidAmount: 50,
        outstandingAmount: 150,
        paymentStatus: 'PARTIAL',
        supplier: { id: 's1', name: 'Supp', phone: '222', email: 's@s.com' },
      },
    ])

    const res = await GET(new NextRequest('http://localhost/api/reports/aging?type=payables&asOf=2026-03-27'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.type).toBe('payables')
    expect(body.summary.totalOutstanding).toBe(150)
    expect(body.rows).toHaveLength(1)
  })
})

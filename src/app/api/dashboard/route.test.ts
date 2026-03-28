import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const {
  cookiesMock,
  createServerClientMock,
  getUserMock,
  prismaMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
  prismaMock: {
    shop: { findUnique: vi.fn() },
    invoice: { aggregate: vi.fn(), findMany: vi.fn() },
    purchase: { aggregate: vi.fn() },
    product: { count: vi.fn() },
    customer: { count: vi.fn() },
  },
}))

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/dashboard GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    cookiesMock.mockResolvedValue({ getAll: () => [] })
    createServerClientMock.mockReturnValue({
      auth: { getUser: getUserMock },
    })
  })

  it('returns 401 when user is unauthorized', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const res = await GET()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 404 when shop is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    prismaMock.shop.findUnique.mockResolvedValue(null)

    const res = await GET()
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Shop not found' })
  })

  it('returns dashboard summary for valid user and shop', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    prismaMock.shop.findUnique.mockResolvedValue({ id: 'shop1' })

    prismaMock.invoice.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.createdAt) return { _sum: { totalAmount: 100 } }
      return { _sum: { totalAmount: 1000 } }
    })

    prismaMock.purchase.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.createdAt) return { _sum: { totalAmount: 50 } }
      return { _sum: { totalAmount: 400 } }
    })

    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv1', totalAmount: 200, customer: { name: 'Acme' } },
    ])
    prismaMock.product.count.mockResolvedValue(25)
    prismaMock.customer.count.mockResolvedValue(10)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary).toEqual({
      totalSales: 1000,
      totalPurchases: 400,
      revenue: 600,
      productsCount: 25,
      customersCount: 10,
    })
    expect(body.chartData).toHaveLength(6)
    expect(body.recentInvoices).toHaveLength(1)
  })
})

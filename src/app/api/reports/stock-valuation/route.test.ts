import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    product: { findMany: vi.fn() },
    purchaseItem: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/reports/stock-valuation GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })
    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(401)
  })

  it('calculates weighted average cost and totals', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Dolo', category: 'Tab', price: 50, stock: 10 },
    ])
    prismaMock.purchaseItem.findMany.mockResolvedValue([
      { productName: 'Dolo', quantity: 5, price: 20 },
      { productName: 'Dolo', quantity: 5, price: 30 },
    ])

    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body[0]).toEqual(expect.objectContaining({
      avgCost: 25,
      totalCostValue: 250,
      totalRetailValue: 500,
    }))
  })
})

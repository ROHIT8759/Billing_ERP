import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    batch: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/reports/expiry GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })
    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(401)
  })

  it('transforms expiry rows with status flags', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    prismaMock.batch.findMany.mockResolvedValue([
      {
        id: 'b1',
        batchNumber: 'BT1',
        quantity: 4,
        expiryDate: new Date('2026-03-26T00:00:00.000Z'),
        product: { id: 'p1', name: 'Prod', category: 'Tab' },
        godown: { name: 'Main' },
      },
      {
        id: 'b2',
        batchNumber: 'BT2',
        quantity: 10,
        expiryDate: new Date('2026-04-01T00:00:00.000Z'),
        product: { id: 'p2', name: 'Prod2', category: null },
        godown: null,
      },
    ])

    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveLength(2)
    expect(body[0]).toEqual(expect.objectContaining({ isExpired: true, daysUntil: 0 }))
    expect(body[1]).toEqual(expect.objectContaining({ isExpired: false, godownName: 'Main' }))
    expect(body[1].daysUntil).toBeGreaterThan(0)
  })
})

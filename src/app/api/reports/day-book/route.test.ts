import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    journalEntry: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/reports/day-book GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })
    const req = new NextRequest('http://localhost/api/reports/day-book')

    const res = await GET(req as any)
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns entries for shop/day', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.journalEntry.findMany.mockResolvedValue([{ id: 'je1' }])

    const req = new NextRequest('http://localhost/api/reports/day-book?date=2026-03-27')
    const res = await GET(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'je1' }])
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ shopId: 's1' }) })
    )
  })
})

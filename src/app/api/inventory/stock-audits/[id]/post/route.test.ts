import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const { mockGetApiUserAndShop, mockPostStockAudit, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  mockPostStockAudit: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/inventory', () => ({
  postStockAudit: mockPostStockAudit,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/inventory/stock-audits/[id]/post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ tx: true })
    })
  })

  it('returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })

    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'a1' }),
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('posts stock audit and returns payload', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    mockPostStockAudit.mockResolvedValue({ id: 'a1', status: 'posted' })

    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'a1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'a1', status: 'posted' })
    expect(mockPostStockAudit).toHaveBeenCalledWith({ tx: true }, 'shop1', 'a1')
  })

  it('maps not found error to 404', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 'shop1' } })
    mockPostStockAudit.mockRejectedValue(new Error('Stock audit not found'))

    const res = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'a404' }),
    })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Stock audit not found' })
  })
})

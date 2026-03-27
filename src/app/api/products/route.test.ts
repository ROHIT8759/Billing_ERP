import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    product: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/products route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 for unauthorized user', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })

    const res = await GET()
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('GET returns products for authorized shop', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Paracetamol' }])

    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([{ id: 'p1', name: 'Paracetamol' }])
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1)
  })

  it('POST validates required fields', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Name and price are required' })
  })

  it('POST rejects invalid primary supplier', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.supplier.findUnique.mockResolvedValue({ id: 'sup1', shopId: 'other-shop' })

    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dolo', price: 55, primarySupplierId: 'sup1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Primary supplier not found' })
  })

  it('POST creates a product', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.product.create.mockResolvedValue({ id: 'p2', name: 'Dolo', price: 55 })

    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: ' Dolo ', price: '55', stock: '10' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 'p2', name: 'Dolo', price: 55 })

    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shopId: 's1',
          name: 'Dolo',
          price: 55,
          stock: 10,
        }),
      })
    )
  })
})

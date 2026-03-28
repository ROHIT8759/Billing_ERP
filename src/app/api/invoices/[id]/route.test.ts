import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, GET } from './route'

const { mockGetApiUserAndShop, deleteJournalEntriesForSourceMock, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  deleteJournalEntriesForSourceMock: vi.fn(),
  prismaMock: {
    invoice: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/accounting', () => ({
  deleteJournalEntriesForSource: deleteJournalEntriesForSourceMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/invoices/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })
    const res = await GET(new Request('http://localhost') as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(401)
  })

  it('GET returns 404 when invoice is missing', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.invoice.findUnique.mockResolvedValue(null)

    const res = await GET(new Request('http://localhost') as any, { params: Promise.resolve({ id: 'i1' }) })
    expect(res.status).toBe(404)
  })

  it('DELETE restocks products and removes invoice journals', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'i1',
      shopId: 's1',
      items: [{ productId: 'p1', quantity: 2 }],
    })

    const txMock = {
      product: { update: vi.fn().mockResolvedValue(undefined) },
      invoice: { delete: vi.fn().mockResolvedValue(undefined) },
    }

    prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

    const res = await DELETE(new Request('http://localhost') as any, { params: Promise.resolve({ id: 'i1' }) })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    expect(txMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: { stock: { increment: 2 } } })
    )
    expect(deleteJournalEntriesForSourceMock).toHaveBeenCalledWith(txMock, 's1', 'Invoice', 'i1')
    expect(txMock.invoice.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
  })
})

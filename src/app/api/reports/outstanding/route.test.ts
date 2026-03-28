import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { mockGetApiUserAndShop, prismaMock } = vi.hoisted(() => ({
  mockGetApiUserAndShop: vi.fn(),
  prismaMock: {
    account: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/api-auth', () => ({
  getApiUserAndShop: mockGetApiUserAndShop,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('/api/reports/outstanding GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthorized', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: null, shop: null })

    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(401)
  })

  it('maps customer and supplier balances and filters zero', async () => {
    mockGetApiUserAndShop.mockResolvedValue({ user: { id: 'u1' }, shop: { id: 's1' } })

    prismaMock.account.findMany.mockResolvedValue([
      {
        id: 'a1',
        type: 'CUSTOMER',
        name: 'Debtor A',
        openingBalance: 10,
        customer: { name: 'Customer A', phone: '111' },
        supplier: null,
        journalLines: [{ debit: 100, credit: 30 }],
      },
      {
        id: 'a2',
        type: 'SUPPLIER',
        name: 'Creditor B',
        openingBalance: 0,
        customer: null,
        supplier: { name: 'Supplier B', phone: '222' },
        journalLines: [{ debit: 10, credit: 70 }],
      },
      {
        id: 'a3',
        type: 'CUSTOMER',
        name: 'Zero',
        openingBalance: 0,
        customer: { name: 'Zero', phone: null },
        supplier: null,
        journalLines: [{ debit: 50, credit: 50 }],
      },
    ])

    const res = await GET(new Request('http://localhost') as any)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveLength(2)
    expect(body[0]).toEqual(expect.objectContaining({ partyName: 'Customer A', netBalance: 80 }))
    expect(body[1]).toEqual(expect.objectContaining({ partyName: 'Supplier B', netBalance: 60 }))
  })
})

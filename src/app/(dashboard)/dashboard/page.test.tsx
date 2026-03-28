import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import DashboardPage from './page'

const { redirectMock, createClientMock, getUserMock, prismaMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
  prismaMock: {
    shop: { findUnique: vi.fn() },
    invoice: { aggregate: vi.fn(), findMany: vi.fn() },
    purchase: { aggregate: vi.fn() },
    product: { count: vi.fn() },
    customer: { count: vi.fn() },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/components/charts/RevenueChart', () => ({
  RevenueChart: ({ data }: { data: unknown[] }) => <div>Revenue Chart ({data.length})</div>,
}))

describe('Dashboard server page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    })
  })

  it('redirects to login when user is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    await expect(DashboardPage()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to onboarding when shop is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    prismaMock.shop.findUnique.mockResolvedValue(null)

    await expect(DashboardPage()).rejects.toThrow('REDIRECT:/onboarding')
  })

  it('renders dashboard overview with recent sales', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    prismaMock.shop.findUnique.mockResolvedValue({ id: 'shop1' })

    prismaMock.invoice.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.createdAt) return { _sum: { totalAmount: 100 } }
      return { _sum: { totalAmount: 3000 } }
    })
    prismaMock.purchase.aggregate.mockImplementation(async (args: any) => {
      if (args?.where?.createdAt) return { _sum: { totalAmount: 80 } }
      return { _sum: { totalAmount: 1200 } }
    })

    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'inv1',
        totalAmount: 500,
        createdAt: '2026-03-27T00:00:00.000Z',
        customer: { name: 'Acme Customer' },
      },
    ])
    prismaMock.product.count.mockResolvedValue(42)
    prismaMock.customer.count.mockResolvedValue(12)

    const jsx = await DashboardPage()
    render(jsx as any)

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument()
    expect(screen.getByText(/Acme Customer/i)).toBeInTheDocument()
    expect(screen.getByText(/Revenue Chart \(6\)/i)).toBeInTheDocument()
  })
})

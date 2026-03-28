import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StockAuditsPage from './page'

const baseAudit = {
  id: 'a1',
  auditDate: '2026-03-27T00:00:00.000Z',
  status: 'draft',
  notes: 'Cycle count',
  postedAt: null,
  godown: { id: 'g1', name: 'Main Godown' },
  items: [
    {
      id: 'it1',
      expectedQty: 10,
      physicalQty: 8,
      differenceQty: -2,
      product: {
        id: 'p1',
        name: 'Paracetamol',
        price: 50,
        stock: 20,
        saltComposition: 'Acetaminophen',
      },
    },
  ],
}

describe('Stock Audits Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  it('loads and displays existing audits', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/godowns')) {
        return { ok: true, json: async () => [{ id: 'g1', name: 'Main Godown' }] }
      }

      if (url.endsWith('/api/inventory/stock-audits')) {
        return { ok: true, json: async () => [baseAudit] }
      }

      throw new Error(`Unhandled URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<StockAuditsPage />)

    expect(screen.getByText('Stock Audits')).toBeInTheDocument()
    await waitFor(async () => {
      const matches = await screen.findAllByText('Main Godown')
      expect(matches.length).toBeGreaterThan(0)
    })
    expect(await screen.findByText('Paracetamol')).toBeInTheDocument()
  })

  it('creates new audit and then posts differences', async () => {
    let auditsData: any[] = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'

      if (url.endsWith('/api/godowns')) {
        return { ok: true, json: async () => [{ id: 'g1', name: 'Main Godown' }] }
      }

      if (url.endsWith('/api/inventory/stock-audits') && method === 'GET') {
        return { ok: true, json: async () => auditsData }
      }

      if (url.endsWith('/api/inventory/stock-audits') && method === 'POST') {
        auditsData = [baseAudit]
        return { ok: true, json: async () => baseAudit }
      }

      if (url.endsWith('/api/inventory/stock-audits/a1') && method === 'PUT') {
        return { ok: true, json: async () => ({ ...baseAudit, notes: 'Cycle count' }) }
      }

      if (url.endsWith('/api/inventory/stock-audits/a1/post') && method === 'POST') {
        return { ok: true, json: async () => ({ ...baseAudit, status: 'posted' }) }
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<StockAuditsPage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'g1' } })
    fireEvent.click(screen.getByRole('button', { name: /New Audit/i }))

    await waitFor(async () => {
      const matches = await screen.findAllByText('Main Godown')
      expect(matches.length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /Post Differences/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/inventory/stock-audits/a1/post',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GodownsPage from './page'

describe('GodownsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('loads and renders godowns with stock', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/godowns')) {
        return {
          ok: true,
          json: async () => ([
            {
              id: 'g1',
              name: 'Main',
              address: 'A street',
              isDefault: true,
              stock: [{ id: 's1', quantity: 5, product: { id: 'p1', name: 'Dolo', price: 10 } }],
              _count: { stock: 1, batches: 1 },
            },
          ]),
        }
      }
      if (url.endsWith('/api/products')) {
        return { ok: true, json: async () => [{ id: 'p1', name: 'Dolo' }] }
      }
      throw new Error(`Unhandled URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<GodownsPage />)

    expect(await screen.findByText('Main')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
  })

  it('creates a godown from modal form', async () => {
    let godownsData: any[] = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'

      if (url.endsWith('/api/godowns') && method === 'GET') {
        return { ok: true, json: async () => godownsData }
      }
      if (url.endsWith('/api/products') && method === 'GET') {
        return { ok: true, json: async () => [{ id: 'p1', name: 'Dolo' }] }
      }
      if (url.endsWith('/api/godowns') && method === 'POST') {
        godownsData = [{
          id: 'g1',
          name: 'Main Warehouse',
          address: null,
          isDefault: false,
          stock: [],
          _count: { stock: 0, batches: 0 },
        }]
        return { ok: true, json: async () => godownsData[0] }
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<GodownsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Godown/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Add Godown/i })[0])

    fireEvent.change(screen.getByPlaceholderText(/Main Warehouse/i), {
      target: { value: 'Main Warehouse' },
    })

    fireEvent.click(screen.getAllByRole('button', { name: /^Add Godown$/i }).at(-1)!)

    await waitFor(() => {
      expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
    })
  })
})

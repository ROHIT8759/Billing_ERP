import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductsPage from './page'

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and renders product list', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 'p1',
            name: 'Paracetamol',
            category: 'Tablet',
            price: 25,
            stock: 30,
            hsnCode: null,
            gstRate: 18,
            mrp: null,
            retailRate: null,
            wholesaleRate: null,
            distributorRate: null,
            saltComposition: 'Acetaminophen',
            minStockLevel: 5,
            reorderLevel: 10,
            maxStockLevel: 100,
            reorderQuantity: 20,
            primarySupplierId: null,
            barcode: null,
            createdAt: '2026-03-27T00:00:00.000Z',
            primarySupplier: null,
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suppliers: [] }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<ProductsPage />)

    expect(screen.getByText('Products')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    })
  })

  it('shows error when products fetch fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ suppliers: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<ProductsPage />)

    expect(await screen.findByText('Failed to fetch products')).toBeInTheDocument()
  })
})

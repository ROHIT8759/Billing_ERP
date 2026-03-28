import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BatchesPage from './page'

describe('BatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('loads batches and shows expiry alerts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/batches')) {
        return {
          ok: true,
          json: async () => ([
            {
              id: 'b1',
              batchNumber: 'BT-OLD',
              mfgDate: null,
              expiryDate: '2026-03-20T00:00:00.000Z',
              quantity: 2,
              createdAt: '2026-03-01T00:00:00.000Z',
              product: { id: 'p1', name: 'Dolo', category: 'Tab' },
              godown: null,
            },
            {
              id: 'b2',
              batchNumber: 'BT-SOON',
              mfgDate: null,
              expiryDate: '2026-03-30T00:00:00.000Z',
              quantity: 3,
              createdAt: '2026-03-01T00:00:00.000Z',
              product: { id: 'p1', name: 'Dolo', category: 'Tab' },
              godown: null,
            },
          ]),
        }
      }
      if (url.endsWith('/api/products')) {
        return { ok: true, json: async () => [{ id: 'p1', name: 'Dolo' }] }
      }
      if (url.endsWith('/api/godowns')) {
        return { ok: true, json: async () => [{ id: 'g1', name: 'Main' }] }
      }
      throw new Error(`Unhandled URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<BatchesPage />)

    expect(await screen.findByText(/1 batch expired/i)).toBeInTheDocument()
    expect(screen.getByText(/1 batch expiring within 7 days/i)).toBeInTheDocument()
    expect(screen.getByText('BT-OLD')).toBeInTheDocument()
  })

  it('filters to expired batches only', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/batches')) {
        return {
          ok: true,
          json: async () => ([
            {
              id: 'b1',
              batchNumber: 'BT-OLD',
              mfgDate: null,
              expiryDate: '2026-03-20T00:00:00.000Z',
              quantity: 2,
              createdAt: '2026-03-01T00:00:00.000Z',
              product: { id: 'p1', name: 'Dolo', category: 'Tab' },
              godown: null,
            },
            {
              id: 'b2',
              batchNumber: 'BT-OK',
              mfgDate: null,
              expiryDate: '2026-05-20T00:00:00.000Z',
              quantity: 3,
              createdAt: '2026-03-01T00:00:00.000Z',
              product: { id: 'p1', name: 'Dolo', category: 'Tab' },
              godown: null,
            },
          ]),
        }
      }
      if (url.endsWith('/api/products')) {
        return { ok: true, json: async () => [{ id: 'p1', name: 'Dolo' }] }
      }
      if (url.endsWith('/api/godowns')) {
        return { ok: true, json: async () => [{ id: 'g1', name: 'Main' }] }
      }
      throw new Error(`Unhandled URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<BatchesPage />)

    await waitFor(() => {
      expect(screen.getByText('BT-OLD')).toBeInTheDocument()
      expect(screen.getByText('BT-OK')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Expired/i }))

    await waitFor(() => {
      expect(screen.getByText('BT-OLD')).toBeInTheDocument()
      expect(screen.queryByText('BT-OK')).not.toBeInTheDocument()
    })
  })
})

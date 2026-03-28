import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewInvoicePage from './page'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('Sales New Invoice Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows API error when invoice creation fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'c1', name: 'Customer 1', state: 'Delhi' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'p1', name: 'Dolo', price: 50, stock: 10, gstRate: 18 }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'shop-1', state: 'Delhi' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed to create invoice' }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<NewInvoicePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'c1' } })
    fireEvent.change(screen.getByDisplayValue(/Select product/i), { target: { value: 'p1' } })

    fireEvent.click(screen.getByRole('button', { name: /Generate Invoice/i }))

    expect(await screen.findByText(/Failed to create invoice/i)).toBeInTheDocument()
  })

  it('submits invoice payload and redirects to detail page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'c1', name: 'Customer 1', state: 'Delhi' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'p1', name: 'Dolo', price: 50, stock: 10, gstRate: 18, hsnCode: '3004' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'shop-1', state: 'Delhi' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'inv-1' }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<NewInvoicePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Invoice/i })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'c1' } })
    fireEvent.change(screen.getByDisplayValue(/Select product/i), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText(/Credit Days/i), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/Initial Payment/i), { target: { value: '25' } })

    fireEvent.click(screen.getByRole('button', { name: /Generate Invoice/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    const [, , , postCall] = fetchMock.mock.calls
    expect(postCall[0]).toBe('/api/invoices')
    expect(postCall[1]?.method).toBe('POST')

    const body = JSON.parse(postCall[1]?.body as string)
    expect(body).toEqual(
      expect.objectContaining({
        customerId: 'c1',
        paymentTermDays: '7',
        initialPaymentAmount: 25,
        paymentMode: 'CASH',
        subtotal: 50,
        discountAmount: 0,
        gstAmount: 9,
        cgstAmount: 4.5,
        sgstAmount: 4.5,
        igstAmount: 0,
        totalAmount: 59,
      })
    )
    expect(body.items).toEqual([
      expect.objectContaining({
        productId: 'p1',
        quantity: 1,
        billedQty: 1,
        freeQty: 0,
        price: 50,
        discountPct: 0,
        hsnCode: '3004',
        taxRate: 18,
      }),
    ])

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/sales/inv-1')
    })
  })
})

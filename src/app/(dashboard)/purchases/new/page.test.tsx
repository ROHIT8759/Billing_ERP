import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewPurchasePage from './page'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('Purchases New Entry Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suppliers: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<NewPurchasePage />)

    await waitFor(() => {
      expect(screen.getByText(/PURCHASE ENTRY/i)).toBeInTheDocument()
    })
  })
})

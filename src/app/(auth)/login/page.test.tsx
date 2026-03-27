import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './page'

const pushMock = vi.fn()
const refreshMock = vi.fn()
const signInWithPasswordMock = vi.fn()
const signInWithOAuthMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    render(<LoginPage />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('logs in successfully and navigates to dashboard', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null })

    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'demo@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'demo@example.com',
        password: 'secret123',
      })
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
      expect(refreshMock).toHaveBeenCalled()
    })
  })

  it('shows auth error when password login fails', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid credentials' } })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'demo@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrong-pass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('starts google oauth flow', async () => {
    signInWithOAuthMock.mockResolvedValue({ error: null })

    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }))

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
        })
      )
    })
  })
})

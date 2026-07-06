import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from '../src/components/LoginPage'

describe('LoginPage', () => {
  it('shows request access and forgot password options', () => {
    render(<LoginPage onLogin={vi.fn()} onRequestAccess={vi.fn()} onForgotPassword={vi.fn()} />)
    expect(screen.getByText('Request access')).toBeInTheDocument()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '../src/components/LoginPage'

describe('LoginPage', () => {
  afterEach(() => cleanup())

  it('shows the new app name', () => {
    render(<LoginPage onLogin={vi.fn()} onForgotPassword={vi.fn()} />)
    expect(screen.getByText('CrewOps Org Chart')).toBeInTheDocument()
    expect(screen.getByText('Crew Operations Organization Chart')).toBeInTheDocument()
  })

  it('keeps account recovery available without exposing public access requests', () => {
    render(<LoginPage onLogin={vi.fn()} onForgotPassword={vi.fn()} />)
    expect(screen.queryByText('Request access')).not.toBeInTheDocument()
    expect(screen.getAllByText('Forgot password?')).toHaveLength(1)
  })
})

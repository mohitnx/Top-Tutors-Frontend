import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders the header with logo', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders the hero section', () => {
    render(<App />)
    expect(screen.getByText(/Master Any Skill/i)).toBeInTheDocument()
  })

  it('renders the features section', () => {
    render(<App />)
    expect(screen.getByText(/Why Choose Us/i)).toBeInTheDocument()
  })

  it('renders call-to-action buttons', () => {
    render(<App />)
    const ctaButtons = screen.getAllByRole('button', { name: /Get Started/i })
    expect(ctaButtons.length).toBeGreaterThan(0)
  })
})


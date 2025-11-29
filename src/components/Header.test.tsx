import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Header from './Header'

describe('Header', () => {
  const mockSetIsMenuOpen = vi.fn()

  it('renders the logo', () => {
    render(<Header isMenuOpen={false} setIsMenuOpen={mockSetIsMenuOpen} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('renders navigation links on desktop', () => {
    render(<Header isMenuOpen={false} setIsMenuOpen={mockSetIsMenuOpen} />)
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(screen.getByText('Tutors')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
  })

  it('renders sign in and get started buttons', () => {
    render(<Header isMenuOpen={false} setIsMenuOpen={mockSetIsMenuOpen} />)
    const signInButtons = screen.getAllByText('Sign In')
    expect(signInButtons.length).toBeGreaterThan(0)
  })

  it('toggles mobile menu when button is clicked', () => {
    render(<Header isMenuOpen={false} setIsMenuOpen={mockSetIsMenuOpen} />)
    const menuButton = screen.getByLabelText('Toggle menu')
    fireEvent.click(menuButton)
    expect(mockSetIsMenuOpen).toHaveBeenCalledWith(true)
  })

  it('shows mobile menu when isMenuOpen is true', () => {
    render(<Header isMenuOpen={true} setIsMenuOpen={mockSetIsMenuOpen} />)
    // Mobile menu should show navigation links twice (desktop + mobile)
    const featuresLinks = screen.getAllByText('Features')
    expect(featuresLinks.length).toBe(2)
  })
})


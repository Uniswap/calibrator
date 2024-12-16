import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders headline', () => {
    render(<App />)
    const headline = screen.getByText(/Calibrator/i)
    expect(headline).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<App />)
    const description = screen.getByText(
      /Cross-chain token swap parameter calculation service/i
    )
    expect(description).toBeInTheDocument()
  })
})

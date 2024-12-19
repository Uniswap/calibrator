import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('App', () => {
  beforeAll(() => {
    mockFetch.mockImplementation((url: string) => {
      if (url === 'http://test/health') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: 'healthy',
              timestamp: '2024-12-19T13:48:24-08:00',
            }),
        })
      }
      return Promise.reject(new Error(`Unhandled fetch to ${url}`))
    })
  })

  afterAll(() => {
    mockFetch.mockReset()
  })

  it('renders headline', async () => {
    render(<App />)
    const headline = await screen.findByText(/Calibrator/i)
    expect(headline).toBeInTheDocument()
  })

  it('renders description', async () => {
    render(<App />)
    const description = await screen.findByText(
      /Cross-chain token swap parameter calculation service/i
    )
    expect(description).toBeInTheDocument()
  })
})

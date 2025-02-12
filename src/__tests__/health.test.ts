import { FastifyInstance } from 'fastify'
import { build } from '../app.js'
import { config } from 'dotenv'

// Load environment variables from .env
config()

// Set up RPC URLs for tests if not already set
process.env.ETHEREUM_RPC_URL =
  process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'
process.env.OPTIMISM_RPC_URL =
  process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com'
process.env.BASE_RPC_URL =
  process.env.BASE_RPC_URL || 'https://base.llamarpc.com'
process.env.UNICHAIN_RPC_URL =
  process.env.UNICHAIN_RPC_URL || 'https://mainnet.unichain.org'

// Mock fetch for asset platforms
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('Health Check', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // Mock fetch response for asset platforms
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { chain_identifier: 1, id: 'ethereum' },
          { chain_identifier: 137, id: 'polygon-pos' },
        ]),
    } as Response)

    app = await build()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should return 200 on health check', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const result = JSON.parse(response.payload)
    expect(result.status).toBe('ok')
    expect(result.timestamp).toBeGreaterThan(0)
  })
})

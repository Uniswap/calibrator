import { FastifyInstance } from 'fastify'
import { build } from '../../app.js'
import { QuoteService } from '../../services/price/QuoteService.js'
import { CoinGeckoProvider } from '../../services/price/providers/CoinGeckoProvider.js'
import { UniswapProvider } from '../../services/price/providers/UniswapProvider.js'
import { Logger } from '../../utils/logger.js'
import { PriceData } from '../../services/price/interfaces/IPriceProvider.js'

// Mock the providers
jest.mock('../../services/price/providers/CoinGeckoProvider')
jest.mock('../../services/price/providers/UniswapProvider')

// Mock fetch for asset platforms
const mockResponse = {
  ok: true,
  json: () =>
    Promise.resolve([
      { chain_identifier: 1, id: 'ethereum' },
      { chain_identifier: 137, id: 'polygon-pos' },
    ]),
}

// Mock token info response
const mockTokenInfoResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      detail_platforms: {
        ethereum: {
          decimal_place: 18,
        },
      },
      symbol: 'TEST',
    }),
}

const mockFetch = jest.fn((url: string | URL | Request) => {
  const urlString = url.toString()
  if (urlString.includes('asset_platforms')) {
    return Promise.resolve(mockResponse)
  }
  return Promise.resolve(mockTokenInfoResponse)
})

global.fetch = mockFetch as jest.Mock

describe('Quote Routes', () => {
  let app: FastifyInstance
  let mockCoinGeckoProvider: jest.Mocked<CoinGeckoProvider>
  let mockUniswapProvider: jest.Mocked<UniswapProvider>
  let quoteService: QuoteService

  const mockPriceData = (price: string): PriceData => ({
    price,
    timestamp: Date.now(),
    source: 'test',
  })

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock providers
    mockCoinGeckoProvider = new CoinGeckoProvider({
      apiUrl: '',
      apiKey: '',
      cacheDurationMs: 0,
    }) as jest.Mocked<CoinGeckoProvider>

    // Mock getSupportedPlatforms
    jest
      .spyOn(mockCoinGeckoProvider, 'getSupportedPlatforms')
      .mockImplementation(() => Promise.resolve(['ethereum', 'polygon-pos']))

    mockUniswapProvider = new UniswapProvider({
      apiUrl: '',
      apiKey: '',
      cacheDurationMs: 0,
    }) as jest.Mocked<UniswapProvider>

    // Create QuoteService
    quoteService = new QuoteService(
      mockCoinGeckoProvider,
      mockUniswapProvider,
      new Logger('QuoteServiceTest')
    )
    await quoteService.initialize()

    // Build app with mock dependencies
    app = await build({
      coinGeckoProvider: mockCoinGeckoProvider,
      uniswapProvider: mockUniswapProvider,
      quoteService: quoteService,
    })

    // Configure content type parser
    app.removeAllContentTypeParsers()
    app.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      async (_: unknown, body: string) => {
        return JSON.parse(body)
      }
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /quote', () => {
    it('should return quote with both providers successful', async () => {
      // Mock CoinGecko responses with proper numeric strings
      mockCoinGeckoProvider.getUsdPrice
        .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // 2000 * 10^18
        .mockResolvedValueOnce(mockPriceData('1000000000000000000')) // 1 * 10^18

      // Mock Uniswap response
      mockUniswapProvider.getUniswapPrice.mockResolvedValue({
        ...mockPriceData('2100000000000000000000'), // 2100 * 10^18
        poolAddress: '0xpool',
        liquidity: '1000000000000000000',
      })

      const payload = {
        inputTokenChainId: 1,
        inputTokenAddress: '0x1234',
        inputTokenAmount: '1000000000000000000', // 1 ETH
        outputTokenChainId: 1,
        outputTokenAddress: '0x5678',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result).toEqual({
        ...payload,
        spotOutputAmount: '2000000000000000000000',
        quoteOutputAmount: '2100000000000000000000',
        deltaAmount: '100000000000000000000', // 100 * 10^18
      })
    })

    it('should validate request payload', async () => {
      const invalidPayload = {
        inputTokenChainId: 1,
        // Missing required fields
        outputTokenAddress: '0x5678',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload: invalidPayload,
      })

      expect(response.statusCode).toBe(400)
    })

    it('should handle provider errors gracefully', async () => {
      // Mock CoinGecko failure
      mockCoinGeckoProvider.getUsdPrice.mockRejectedValue(
        new Error('API error')
      )

      // Mock Uniswap failure
      mockUniswapProvider.getUniswapPrice.mockRejectedValue(
        new Error('No pool found')
      )

      const payload = {
        inputTokenChainId: 1,
        inputTokenAddress: '0x1234',
        inputTokenAmount: '1000000000000000000',
        outputTokenChainId: 1,
        outputTokenAddress: '0x5678',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result).toEqual({
        ...payload,
        spotOutputAmount: null,
        quoteOutputAmount: null,
        deltaAmount: null,
      })
    })

    it('should handle unsupported chains', async () => {
      const payload = {
        inputTokenChainId: 999, // Unsupported chain
        inputTokenAddress: '0x1234',
        inputTokenAmount: '1000000000000000000',
        outputTokenChainId: 1,
        outputTokenAddress: '0x5678',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload,
      })

      expect(response.statusCode).toBe(400)
      const error = JSON.parse(response.payload)
      expect(error.error).toBe('Unsupported chain ID: 999')
    })
  })
})

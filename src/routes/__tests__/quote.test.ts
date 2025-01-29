import { FastifyInstance } from 'fastify'
import { build } from '../../app'
import { QuoteService } from '../../services/price/QuoteService'
import { CoinGeckoProvider } from '../../services/price/providers/CoinGeckoProvider'
import { UniswapProvider } from '../../services/price/providers/UniswapProvider'
import { PriceData } from '../../services/price/interfaces/IPriceProvider'
import { Logger } from '../../utils/logger'

// Mock the providers
jest.mock('../../services/price/providers/CoinGeckoProvider')
jest.mock('../../services/price/providers/UniswapProvider')

// Create a mock logger that extends the Logger class
class MockLogger extends Logger {
  constructor() {
    super('test-logger', true)
  }

  error = jest.fn()
  info = jest.fn()
  debug = jest.fn()
}

const mockLogger = new MockLogger()

// Mock fetch for asset platforms and token info
global.fetch = jest.fn().mockImplementation(url => {
  const urlStr = url.toString()

  if (urlStr.includes('/asset_platforms')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'ethereum',
            chain_identifier: 1,
            name: 'Ethereum',
          },
          {
            id: 'optimistic-ethereum',
            chain_identifier: 10,
            name: 'Optimism',
          },
          {
            id: 'base',
            chain_identifier: 8453,
            name: 'Base',
          },
          {
            id: 'arbitrum-one',
            chain_identifier: 42161,
            name: 'Arbitrum One',
          },
        ]),
    })
  }

  // Mock token info response
  if (urlStr.includes('/coins/')) {
    // Extract platform and token address from URL
    const matches = urlStr.match(/\/coins\/([^/]+)\/contract\/([^/]+)/)
    if (matches) {
      const [, platform] = matches
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            detail_platforms: {
              [platform]: { decimal_place: 18 },
            },
            symbol: 'TEST',
          }),
      })
    }
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
})

// Get the mock constructors
const mockCoinGeckoProvider = CoinGeckoProvider as jest.MockedClass<
  typeof CoinGeckoProvider
>
const mockUniswapProvider = UniswapProvider as jest.MockedClass<
  typeof UniswapProvider
>

describe('Quote Routes', () => {
  let app: FastifyInstance
  let quoteService: QuoteService
  let coinGeckoProvider: CoinGeckoProvider
  let uniswapProvider: UniswapProvider

  beforeAll(async () => {
    // Create and initialize providers
    coinGeckoProvider = new CoinGeckoProvider({
      apiUrl: 'https://pro-api.coingecko.com/api/v3', // Match the URL in app.ts
      cacheDurationMs: 30000,
    })
    uniswapProvider = new UniswapProvider({
      apiUrl: 'https://api.uniswap.org/v1',
      cacheDurationMs: 30000,
    })

    // Create QuoteService with mock logger
    quoteService = new QuoteService(
      coinGeckoProvider,
      uniswapProvider,
      mockLogger
    )

    // Initialize QuoteService before building app
    await quoteService.initialize()

    // Initialize the app with the initialized QuoteService
    app = await build({
      coinGeckoProvider,
      uniswapProvider,
      quoteService,
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock getSupportedPlatforms to include all needed platforms
    mockCoinGeckoProvider.prototype.getSupportedPlatforms.mockResolvedValue([
      'ethereum',
      'optimistic-ethereum',
      'base',
      'arbitrum-one',
    ])
  })

  describe('POST /quote', () => {
    it('should return quote with arbiter configuration for Optimism -> Base', async () => {
      const mockQuote = {
        inputTokenAddress: '0x4444444444444444444444444444444444444444',
        inputTokenChainId: 10,
        inputTokenAmount: '1000000000000000000',
        outputTokenAddress: '0x5555555555555555555555555555555555555555',
        outputTokenChainId: 8453,
        lockParameters: {
          allocatorId: '123',
          resetPeriod: 4,
          isMultichain: true,
        },
      }

      // Mock CoinGecko responses
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)

      // Mock Uniswap responses
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload: mockQuote,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)

      // Verify data and context structure
      expect(result.data).toBeDefined()
      expect(result.data.arbiter).toBe(
        '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9'
      )
      expect(result.data.mandate).toBeDefined()

      const mandate = result.data.mandate
      expect(mandate.chainId).toBe(mockQuote.outputTokenChainId)
      expect(mandate.tribunal).toBe(
        '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1'
      )
      // With input amount 1.0, input price 2.0 USD, and output price 1.0 USD
      // Output amount should be 2.0 tokens
      // With 100 bips (1%) slippage, minimum amount should be 1.98 tokens
      expect(mandate.minimumAmount).toBe('1980000000000000000')
      expect(mandate.salt).toBe(
        '0x3333333333333333333333333333333333333333333333333333333333333333'
      )

      // Verify witness hash is in context
      expect(result.context.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should return 400 for unsupported chain pair', async () => {
      const mockQuote = {
        inputTokenAddress: '0x4444444444444444444444444444444444444444',
        inputTokenChainId: 10,
        inputTokenAmount: '1000000000000000000',
        outputTokenAddress: '0x5555555555555555555555555555555555555555',
        outputTokenChainId: 42161, // Use Arbitrum chain ID which we don't have an arbiter for
        lockParameters: {
          allocatorId: '123',
          resetPeriod: 4,
          isMultichain: true,
        },
      }

      // Mock CoinGecko responses
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)

      // Mock Uniswap responses
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload: mockQuote,
      })

      console.log('Response payload:', response.payload)
      console.log('Logger error calls:', mockLogger.error.mock.calls)

      expect(response.statusCode).toBe(400)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('No arbiter found for chain pair 10-42161')
    })

    it('should handle custom context parameters', async () => {
      const mockQuote = {
        inputTokenAddress: '0x4444444444444444444444444444444444444444',
        inputTokenChainId: 10,
        inputTokenAmount: '1000000000000000000',
        outputTokenAddress: '0x5555555555555555555555555555555555555555',
        outputTokenChainId: 8453,
        context: {
          slippageBips: 50,
          recipient: '0x7777777777777777777777777777777777777777',
          baselinePriorityFee: '2000000000',
          scalingFactor: '1000000000200000000',
        },
      }

      // Mock CoinGecko responses
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)
      mockCoinGeckoProvider.prototype.getUsdPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 USD with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'coingecko',
      } as PriceData)

      // Mock Uniswap responses
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '2000000000000000000', // 2.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)
      mockUniswapProvider.prototype.getUniswapPrice.mockResolvedValueOnce({
        price: '1000000000000000000', // 1.0 with 18 decimals
        lastUpdated: new Date().toISOString(),
        timestamp: Date.now(),
        source: 'uniswap',
      } as PriceData)

      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload: mockQuote,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)

      const mandate = result.data.mandate
      expect(mandate.recipient).toBe(mockQuote.context.recipient)
      // With input amount 1.0, input price 2.0 USD, and output price 1.0 USD
      // Output amount should be 2.0 tokens
      // With 50 bips (0.5%) slippage, minimum amount should be 1.99 tokens
      expect(mandate.minimumAmount).toBe('1990000000000000000')
      expect(mandate.baselinePriorityFee).toBe(
        mockQuote.context.baselinePriorityFee
      )
      expect(mandate.scalingFactor).toBe(mockQuote.context.scalingFactor)
    })
  })
})

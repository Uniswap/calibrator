import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { QuoteService } from '../QuoteService.js'
import { CoinGeckoProvider } from '../providers/CoinGeckoProvider.js'
import { UniswapProvider } from '../providers/UniswapProvider.js'
import { Logger } from '../../../utils/logger.js'
import { PriceData } from '../interfaces/IPriceProvider.js'

// Mock fetch
const mockResponse = {
  ok: true,
  json: () =>
    Promise.resolve([
      { chain_identifier: 1, id: 'ethereum' },
      { chain_identifier: 137, id: 'polygon-pos' },
    ]),
} as Response

// Create a properly typed mock fetch function
const mockFetch = jest.fn(
  (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
    Promise.resolve(mockResponse)
)

// Type assertion for global fetch
global.fetch = mockFetch as unknown as typeof global.fetch

// Mock providers
jest.mock('../providers/CoinGeckoProvider')
jest.mock('../providers/UniswapProvider')

describe('QuoteService', () => {
  let quoteService: QuoteService
  let mockCoinGeckoProvider: jest.Mocked<CoinGeckoProvider>
  let mockUniswapProvider: jest.Mocked<UniswapProvider>
  let mockLogger: Logger

  const mockPriceData = (price: string): PriceData => ({
    price,
    timestamp: Date.now(),
    source: 'test',
  })

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock providers
    mockCoinGeckoProvider = new CoinGeckoProvider({
      apiUrl: '',
      apiKey: '',
      cacheDurationMs: 0,
    }) as jest.Mocked<CoinGeckoProvider>

    mockUniswapProvider = new UniswapProvider({
      apiUrl: '',
      apiKey: '',
      cacheDurationMs: 0,
    }) as jest.Mocked<UniswapProvider>

    mockLogger = new Logger('QuoteServiceTest')

    // Create QuoteService instance
    quoteService = new QuoteService(
      mockCoinGeckoProvider,
      mockUniswapProvider,
      mockLogger
    )
  })

  test('initializes with chain mapping', async () => {
    await quoteService.initialize()

    expect(global.fetch).toHaveBeenCalledWith(
      'https://pro-api.coingecko.com/api/v3/asset_platforms',
      expect.any(Object)
    )
  })

  test('gets quote with both providers successful', async () => {
    await quoteService.initialize()

    const mockRequest = {
      inputTokenChainId: 1,
      inputTokenAddress: '0x1234',
      inputTokenAmount: '1000000000000000000', // 1 ETH
      outputTokenChainId: 1,
      outputTokenAddress: '0x5678',
    }

    // Mock CoinGecko responses with proper numeric strings
    mockCoinGeckoProvider.getPrice
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // 2000 * 10^18
      .mockResolvedValueOnce(mockPriceData('1000000000000000000')) // 1 * 10^18

    // Mock Uniswap response
    mockUniswapProvider.getUniswapPrice.mockResolvedValue({
      ...mockPriceData('2100000000000000000000'), // 2100 * 10^18
      poolAddress: '0xpool',
      liquidity: '1000000000000000000',
    })

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmount: '2100000000000000000000',
      deltaAmount: '100000000000000000000', // 100 * 10^18
    })
  })

  test('gets quote with CoinGecko failure', async () => {
    await quoteService.initialize()

    const mockRequest = {
      inputTokenChainId: 1,
      inputTokenAddress: '0x1234',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: '0x5678',
    }

    // Mock CoinGecko failure
    mockCoinGeckoProvider.getPrice.mockRejectedValue(new Error('API error'))

    // Mock Uniswap success
    mockUniswapProvider.getUniswapPrice.mockResolvedValue({
      ...mockPriceData('2100000000000000000000'),
      poolAddress: '0xpool',
      liquidity: '1000000000000000000',
    })

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: null,
      quoteOutputAmount: '2100000000000000000000',
      deltaAmount: null,
    })
  })

  test('gets quote with Uniswap failure', async () => {
    await quoteService.initialize()

    const mockRequest = {
      inputTokenChainId: 1,
      inputTokenAddress: '0x1234',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: '0x5678',
    }

    // Mock CoinGecko success
    mockCoinGeckoProvider.getPrice
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000'))
      .mockResolvedValueOnce(mockPriceData('1000000000000000000'))

    // Mock Uniswap failure
    mockUniswapProvider.getUniswapPrice.mockRejectedValue(
      new Error('No pool found')
    )

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmount: null,
      deltaAmount: null,
    })
  })

  test('throws error for unsupported chain', async () => {
    await quoteService.initialize()

    const mockRequest = {
      inputTokenChainId: 999, // Unsupported chain
      inputTokenAddress: '0x1234',
      inputTokenAmount: '1000000000000000000',
      outputTokenChainId: 1,
      outputTokenAddress: '0x5678',
    }

    await expect(quoteService.getQuote(mockRequest)).rejects.toThrow(
      'Unsupported chain ID: 999'
    )
  })
})

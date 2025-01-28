import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { QuoteService } from '../QuoteService.js'
import { CoinGeckoProvider } from '../providers/CoinGeckoProvider.js'
import { UniswapProvider } from '../providers/UniswapProvider.js'
import { Logger } from '../../../utils/logger.js'
import { PriceData } from '../interfaces/IPriceProvider.js'

// Mock environment variables
beforeEach(() => {
  process.env.ETHEREUM_RPC_URL = 'http://localhost:8545'
  process.env.OPTIMISM_RPC_URL = 'http://localhost:8546'
  process.env.BASE_RPC_URL = 'http://localhost:8547'
})

afterEach(() => {
  delete process.env.ETHEREUM_RPC_URL
  delete process.env.OPTIMISM_RPC_URL
  delete process.env.BASE_RPC_URL
})

// Mock fetch
const mockAssetPlatformsResponse = {
  ok: true,
  json: () =>
    Promise.resolve([
      { chain_identifier: 1, id: 'ethereum' },
      { chain_identifier: 10, id: 'optimistic-ethereum' },
      { chain_identifier: 8453, id: 'base' },
      { chain_identifier: 137, id: 'polygon-pos' },
    ]),
}

const mockTokenInfoResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      detail_platforms: {
        ethereum: {
          decimal_place: 18,
        },
        'optimistic-ethereum': {
          decimal_place: 18,
        },
        base: {
          decimal_place: 18,
        },
      },
      symbol: 'TEST',
    }),
}

const mockFetch = jest.fn((url: string | URL | Request) => {
  const urlString = url.toString()
  if (urlString.includes('asset_platforms')) {
    return Promise.resolve(mockAssetPlatformsResponse)
  }
  return Promise.resolve(mockTokenInfoResponse)
}) as jest.Mock

// Type assertion for global fetch
global.fetch = mockFetch as unknown as typeof global.fetch

// Mock providers
jest.mock('../providers/CoinGeckoProvider')
jest.mock('../providers/UniswapProvider')
jest.mock('../../quote/TribunalService')

describe('QuoteService', () => {
  let quoteService: QuoteService
  let mockCoinGeckoProvider: jest.Mocked<CoinGeckoProvider>
  let mockUniswapProvider: jest.Mocked<UniswapProvider>
  let mockLogger: Logger
  let mockTribunalService: jest.Mocked<any>

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
      .mockImplementation(() =>
        Promise.resolve([
          'ethereum',
          'polygon-pos',
          'optimistic-ethereum',
          'base',
        ])
      )

    mockUniswapProvider = new UniswapProvider({
      apiUrl: '',
      apiKey: '',
      cacheDurationMs: 0,
    }) as jest.Mocked<UniswapProvider>

    mockLogger = new Logger('QuoteServiceTest')

    // Mock TribunalService
    mockTribunalService = {
      getQuote: jest
        .fn()
        .mockImplementation(() => Promise.resolve('50000000000000000')), // 0.05 ETH dispensation
    }
    jest
      .spyOn(await import('../../quote/TribunalService.js'), 'TribunalService')
      .mockImplementation(() => mockTribunalService)

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
    mockCoinGeckoProvider.getUsdPrice
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
      tribunalQuote: null,
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
    mockCoinGeckoProvider.getUsdPrice.mockRejectedValue(new Error('API error'))

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
      tribunalQuote: null,
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
    mockCoinGeckoProvider.getUsdPrice
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
      tribunalQuote: null,
    })
  })

  test('gets quote with tribunal quote', async () => {
    await quoteService.initialize()

    const mockRequest = {
      inputTokenChainId: 10, // Optimism
      inputTokenAddress: '0x1234',
      inputTokenAmount: '1000000000000000000', // 1 ETH
      outputTokenChainId: 8453, // Base
      outputTokenAddress: '0x5678',
      lockParameters: {
        allocatorId: '123',
        resetPeriod: 4,
        isMultichain: true,
      },
      context: {
        slippageBips: 50,
        recipient: '0x7777777777777777777777777777777777777777',
        expires: '1703023200', // 2023-12-20T00:00:00Z
        baselinePriorityFee: '2000000000',
        scalingFactor: '1000000000200000000',
      },
    }

    // Mock CoinGecko responses
    mockCoinGeckoProvider.getUsdPrice
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
      inputTokenAmount: '1000000000000000000',
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmount: '2100000000000000000000',
      deltaAmount: '100000000000000000000', // 100 * 10^18
      tribunalQuote: '50000000000000000', // 0.05 ETH dispensation
    })

    // Verify TribunalService was called with correct parameters
    const expectedContext = {
      recipient: mockRequest.context.recipient,
      expires: '1703023200',
      token: mockRequest.outputTokenAddress,
      minimumAmount: '2089500000000000000000', // 99.5% of output amount (50 bips slippage)
      baselinePriorityFee: '2000000000',
      scalingFactor: '1000000000200000000',
      salt: '0x3333333333333333333333333333333333333333333333333333333333333333',
    }

    expect(mockTribunalService.getQuote).toHaveBeenCalledWith(
      expect.any(String), // arbiter
      mockRequest.context.recipient,
      '0', // nonce
      expectedContext.expires,
      mockRequest.lockParameters.allocatorId,
      '2100000000000000000000', // using quote output amount
      mockRequest.inputTokenChainId,
      mockRequest.context.recipient,
      '2100000000000000000000', // claim amount
      expectedContext,
      mockRequest.outputTokenChainId
    )
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

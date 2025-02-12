import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { QuoteService } from '../QuoteService.js'
import { CoinGeckoProvider } from '../providers/CoinGeckoProvider.js'
import { UniswapProvider } from '../providers/UniswapProvider.js'
import { Logger } from '../../../utils/logger.js'
import { PriceData } from '../interfaces/IPriceProvider.js'
import { TribunalService } from '../../quote/TribunalService.js'
import { PublicClient } from 'viem'
import { QuoteConfigurationService } from '../../quote/QuoteConfigurationService.js'

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
  let mockTribunalService: jest.Mocked<TribunalService>

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

    // Create mock clients
    const mockClient = {
      account: undefined,
      batch: { multicall: true },
      cacheTime: 4000,
      pollingInterval: 4000,
      name: 'Mock Client',
      transport: { type: 'http' },
      type: 'publicClient',
      uid: 'mock',
      request: jest.fn(),
      extend: jest.fn(),
    } as unknown as PublicClient

    // Create a complete mock of TribunalService
    mockTribunalService = {
      ethereumClient: mockClient,
      optimismClient: mockClient,
      baseClient: mockClient,
      unichainClient: mockClient,
      quoteConfigService: {} as QuoteConfigurationService,
      getQuote: jest.fn(),
      verifyMandateHash: jest.fn(),
      getClientForChain: (_chainId: number): PublicClient => mockClient,
      getTribunalAddress: (chainId: number): `0x${string}` => {
        const addresses: Record<number, `0x${string}`> = {
          1: '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662',
          10: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
          8453: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
          130: '0x7f268357A8c2552623316e2562D90e642bB538E5',
        }
        const address = addresses[chainId]
        if (!address)
          throw new Error(`No tribunal address for chain ID: ${chainId}`)
        return address
      },
    } as unknown as jest.Mocked<TribunalService>

    // Set up mock implementation for getQuote
    mockTribunalService.getQuote.mockImplementation(
      async (
        _chainId: number,
        _arbiter: string,
        _sponsor: string,
        _nonce: bigint,
        _expires: bigint,
        _id: bigint,
        _amount: bigint,
        _sponsorSignature: string,
        _allocatorSignature: string,
        _mandate: any,
        _claimant: string,
        _targetChainId: number
      ) => {
        return BigInt('50000000000000000') // 0.05 ETH
      }
    )

    jest
      .spyOn(await import('../../quote/TribunalService.js'), 'TribunalService')
      .mockImplementation(() => mockTribunalService)

    // Create QuoteService instance with mocked dependencies
    quoteService = new QuoteService(
      mockCoinGeckoProvider,
      mockUniswapProvider,
      mockTribunalService,
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
      sponsor: '0x1111111111111111111111111111111111111111',
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
      outputAmountDirect: '2100000000000000000000',
      outputAmountNet: '2100000000000000000000',
    })

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmountDirect: '2100000000000000000000',
      quoteOutputAmountNet: '2100000000000000000000',
      deltaAmount: '100000000000000000000', // Net quote - spot = 2100 - 2000 = 100
      tribunalQuote: null,
      tribunalQuoteUsd: null,
    })
  })

  test('gets quote with CoinGecko failure', async () => {
    await quoteService.initialize()

    const mockRequest = {
      sponsor: '0x1111111111111111111111111111111111111111',
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
      outputAmountDirect: '2100000000000000000000',
      outputAmountNet: '2100000000000000000000',
    })

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: null,
      quoteOutputAmountDirect: '2100000000000000000000',
      quoteOutputAmountNet: '2100000000000000000000',
      deltaAmount: null, // No spot price to calculate delta
      tribunalQuote: null,
      tribunalQuoteUsd: null,
    })
  })

  test('gets quote with Uniswap failure', async () => {
    await quoteService.initialize()

    const mockRequest = {
      sponsor: '0x1111111111111111111111111111111111111111',
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
      quoteOutputAmountDirect: null,
      quoteOutputAmountNet: null,
      deltaAmount: null, // No quote to calculate delta
      tribunalQuote: null,
      tribunalQuoteUsd: null,
    })
  })

  test('gets quote with tribunal quote', async () => {
    await quoteService.initialize()

    const mockRequest = {
      sponsor: '0x1111111111111111111111111111111111111111',
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
        fillExpires: '1703023200', // Required for tribunal quote
        baselinePriorityFee: '2000000000',
        scalingFactor: '1000000000200000000',
      },
    }

    // Mock CoinGecko responses
    mockCoinGeckoProvider.getUsdPrice
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // 2000 * 10^18
      .mockResolvedValueOnce(mockPriceData('1000000000000000000')) // 1 * 10^18
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // ETH price: 2000 * 10^18

    // Mock preliminary Uniswap quote
    mockUniswapProvider.getUniswapPrice
      .mockResolvedValueOnce({
        ...mockPriceData('2100000000000000000000'), // 2100 * 10^18 (preliminary)
        poolAddress: '0xpool',
        liquidity: '1000000000000000000',
        outputAmountDirect: '2100000000000000000000',
        outputAmountNet: '2100000000000000000000',
      })
      // Mock final quote with dispensation (2.05 tokens after 0.05 ETH dispensation)
      .mockResolvedValueOnce({
        ...mockPriceData('2050000000000000000000'), // 2050 * 10^18 (after dispensation)
        poolAddress: '0xpool',
        liquidity: '1000000000000000000',
        outputAmountDirect: '2100000000000000000000', // Keep original direct amount
        outputAmountNet: '2050000000000000000000', // Net amount after dispensation
      })

    // Mock tribunal quotes
    mockTribunalService.getQuote
      .mockResolvedValueOnce(BigInt('50000000000000000')) // Initial quote: 0.05 ETH
      .mockResolvedValueOnce(BigInt('50000000000000000')) // Final quote: 0.05 ETH

    const result = await quoteService.getQuote(mockRequest)

    expect(result).toEqual({
      ...mockRequest,
      inputTokenAmount: '1000000000000000000',
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmountDirect: '2100000000000000000000',
      quoteOutputAmountNet: '2100000000000000000000',
      deltaAmount: '100000000000000000000', // Net quote - spot = 2100 - 2000 = 100
      tribunalQuote: '50000000000000000', // 0.05 ETH dispensation
      tribunalQuoteUsd: '100000000000000000000', // 0.05 ETH * 2000 USD = 100 USD
    })

    // Verify TribunalService was called with correct parameters
    const expectedContext = {
      recipient: mockRequest.context.recipient,
      expires: '1703023200',
      token: mockRequest.outputTokenAddress,
      minimumAmount: '2089500000000000000000', // 99.5% of output amount (50 bips slippage)
      baselinePriorityFee: '2000000000',
      scalingFactor: '1000000000200000000',
      salt: expect.stringMatching(/^0x[a-f0-9]{64}$/),
    }

    expect(mockTribunalService.getQuote).toHaveBeenCalledWith(
      mockRequest.inputTokenChainId,
      expect.any(String), // arbiter address
      mockRequest.sponsor,
      0n, // nonce
      BigInt(expectedContext.expires),
      BigInt(mockRequest.lockParameters.allocatorId),
      expect.any(BigInt), // quote amount
      expect.any(String), // signature 1
      expect.any(String), // signature 2
      {
        ...expectedContext,
        expires: BigInt(expectedContext.expires),
        minimumAmount: BigInt(expectedContext.minimumAmount),
        baselinePriorityFee: BigInt(expectedContext.baselinePriorityFee),
        scalingFactor: BigInt(expectedContext.scalingFactor),
      },
      mockRequest.context.recipient,
      mockRequest.outputTokenChainId
    )
  })

  test('handles error when dispensation exceeds intermediate amount', async () => {
    await quoteService.initialize()

    const mockRequest = {
      sponsor: '0x1111111111111111111111111111111111111111',
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
    }

    // Mock CoinGecko responses
    mockCoinGeckoProvider.getUsdPrice
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // 2000 * 10^18
      .mockResolvedValueOnce(mockPriceData('1000000000000000000')) // 1 * 10^18
      .mockResolvedValueOnce(mockPriceData('2000000000000000000000')) // ETH price: 2000 * 10^18

    // Mock preliminary quote with low intermediate amount
    mockUniswapProvider.getUniswapPrice
      .mockResolvedValueOnce({
        ...mockPriceData('500000000000000000'), // 0.5 ETH intermediate
        poolAddress: '0xpool',
        liquidity: '1000000000000000000',
        outputAmountDirect: '500000000000000000',
        outputAmountNet: '500000000000000000',
      })
      // Mock final quote attempt failing due to excessive dispensation
      .mockRejectedValueOnce(
        new Error('Dispensation amount exceeds intermediate quote amount')
      )

    // Mock tribunal returning a larger dispensation
    mockTribunalService.getQuote
      .mockResolvedValueOnce(BigInt('600000000000000000')) // Initial quote: 0.6 ETH
      .mockResolvedValueOnce(BigInt('600000000000000000')) // Final quote: 0.6 ETH

    const result = await quoteService.getQuote(mockRequest)

    // Should still return a response but with null quote amounts
    expect(result).toEqual({
      ...mockRequest,
      spotOutputAmount: '2000000000000000000000',
      quoteOutputAmountDirect: null,
      quoteOutputAmountNet: null,
      deltaAmount: null,
      tribunalQuote: null,
      tribunalQuoteUsd: null,
    })
  })

  test('throws error for unsupported chain', async () => {
    await quoteService.initialize()

    const mockRequest = {
      sponsor: '0x1111111111111111111111111111111111111111',
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

import { UniswapProvider } from '../../providers/UniswapProvider.js'
import { Token } from '../../interfaces/IPriceProvider.js'
import { UniswapConfig } from '../../interfaces/IUniswapProvider.js'
import { Logger } from '../../../../utils/logger.js'
import { IndicativeQuoteResponse } from '../../types/uniswap.js'

describe('UniswapProvider', () => {
  const mockConfig: UniswapConfig = {
    apiUrl: 'https://trade-api.gateway.uniswap.org',
    apiKey: 'test-key',
    cacheDurationMs: 30000,
  }

  const silentLogger = new Logger('test', true)

  const mockToken = (
    address: string = '0x0000000000000000000000000000000000000000'
  ): Token => ({
    address,
    chainId: 1,
    decimals: 18,
    symbol: 'TEST',
  })

  const mockQuoteResponse: IndicativeQuoteResponse = {
    requestId: 'test-request-id',
    type: 'EXACT_INPUT',
    input: {
      token: '0x0000000000000000000000000000000000000000',
      chainId: 1,
      amount: '1000000000000000000', // 1 ETH
    },
    output: {
      token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      chainId: 1,
      amount: '2000000000', // 2000 USDC (6 decimals)
    },
  }

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should fetch price successfully', async () => {
    // Mock successful API response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockQuoteResponse),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const tokenIn = mockToken()
    const tokenOut = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') // USDC

    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '2000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith(
      'https://trade-api.gateway.uniswap.org/v1/indicative_quote',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': 'test-key',
        }),
      })
    )
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Invalid token pair'),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const tokenIn = mockToken()
    const tokenOut = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

    await expect(provider.getPrice(tokenIn, tokenOut)).rejects.toThrow(
      'Uniswap API error: Invalid token pair'
    )
  })

  it('should check pool existence', async () => {
    // Mock successful API response for pool check
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockQuoteResponse),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const tokenA = mockToken()
    const tokenB = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

    const hasPool = await provider.hasDirectPool(tokenA, tokenB)
    expect(hasPool).toBe(true)
  })

  it('should handle non-existent pools', async () => {
    // Mock API error for non-existent pool
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('No route found'),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const tokenA = mockToken()
    const tokenB = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

    const hasPool = await provider.hasDirectPool(tokenA, tokenB)
    expect(hasPool).toBe(false)
  })
})

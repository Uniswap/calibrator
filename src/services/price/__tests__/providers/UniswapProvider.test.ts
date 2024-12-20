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
    address: string = '0x0000000000000000000000000000000000000000',
    chainId: number = 1
  ): Token => ({
    address,
    chainId,
    decimals: 18,
    symbol: 'TEST',
  })

  const mockQuoteResponse = (
    inputToken: string,
    outputToken: string,
    inputChainId: number,
    outputChainId: number,
    inputAmount: string,
    outputAmount: string
  ): IndicativeQuoteResponse => ({
    requestId: 'test-request-id',
    type: 'EXACT_INPUT',
    input: {
      token: inputToken,
      chainId: inputChainId,
      amount: inputAmount,
    },
    output: {
      token: outputToken,
      chainId: outputChainId,
      amount: outputAmount,
    },
  })

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should fetch same-chain price successfully', async () => {
    const tokenIn = mockToken()
    const tokenOut = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    const response = mockQuoteResponse(
      tokenIn.address,
      tokenOut.address,
      1,
      1,
      '1000000000000000000',
      '2000000000'
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '2000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })
  })

  it('should handle cross-chain quote with non-native tokens', async () => {
    const tokenIn = mockToken('0x1234', 1) // Custom token on chain 1
    const tokenOut = mockToken('0x5678', 2) // Custom token on chain 2

    // Mock first quote (tokenIn to native on chain 1)
    const firstResponse = mockQuoteResponse(
      tokenIn.address,
      '0x0000000000000000000000000000000000000000',
      1,
      1,
      '1000000000000000000',
      '500000000000000000'
    )

    // Mock second quote (native to tokenOut on chain 2)
    const secondResponse = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      '500000000000000000',
      '1000000000'
    )

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firstResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondResponse),
      })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '1000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should handle cross-chain quote with native token input', async () => {
    const tokenIn = mockToken('0x0000000000000000000000000000000000000000', 1) // Native on chain 1
    const tokenOut = mockToken('0x5678', 2) // Custom token on chain 2

    // Mock quote (native to tokenOut on chain 2)
    const response = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      '1000000000000000000',
      '2000000000'
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '2000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should handle cross-chain quote with native token output', async () => {
    const tokenIn = mockToken('0x1234', 1) // Custom token on chain 1
    const tokenOut = mockToken('0x0000000000000000000000000000000000000000', 2) // Native on chain 2

    // Mock quote (tokenIn to native on chain 1)
    const response = mockQuoteResponse(
      tokenIn.address,
      '0x0000000000000000000000000000000000000000',
      1,
      1,
      '1000000000000000000',
      '500000000000000000'
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '500000000000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should return input amount when both tokens are native', async () => {
    const tokenIn = mockToken('0x0000000000000000000000000000000000000000', 1)
    const tokenOut = mockToken('0x0000000000000000000000000000000000000000', 2)

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getUniswapPrice(
      tokenIn,
      tokenOut,
      '1000000000000000000'
    )

    expect(price).toEqual({
      price: '1000000000000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
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
    const tokenA = mockToken()
    const tokenB = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    const response = mockQuoteResponse(
      tokenA.address,
      tokenB.address,
      1,
      1,
      '1000000',
      '2000000'
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const hasPool = await provider.hasDirectPool(tokenA, tokenB)
    expect(hasPool).toBe(true)
  })

  it('should handle non-existent pools', async () => {
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

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

  const mockFetchResponse = (response: IndicativeQuoteResponse) => ({
    ok: true,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(''),
  })

  const mockErrorResponse = (error: string) => ({
    ok: false,
    text: () => Promise.resolve(error),
  })

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should fetch same-chain price successfully with direct and net amounts', async () => {
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

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(response))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '2000000000',
      outputAmountDirect: '2000000000',
      outputAmountNet: '2000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })
  })

  it('should handle cross-chain quote with dispensation amount', async () => {
    const tokenIn = mockToken('0x1234', 1)
    const tokenOut = mockToken('0x5678', 2)
    const dispensationAmount = '100000000000000000' // 0.1 ETH

    // First quote: tokenIn to native on chain 1
    const firstResponse = mockQuoteResponse(
      tokenIn.address,
      '0x0000000000000000000000000000000000000000',
      1,
      1,
      '1000000000000000000',
      '500000000000000000' // 0.5 ETH intermediate
    )

    // Second quote for direct amount: 0.5 ETH to tokenOut
    const directResponse = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      '500000000000000000',
      '1000000000' // Direct output
    )

    // Third quote for net amount: (0.5 - 0.1) ETH to tokenOut
    const netResponse = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      '400000000000000000',
      '800000000' // Net output after dispensation
    )

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(firstResponse))
      .mockResolvedValueOnce(mockFetchResponse(directResponse))
      .mockResolvedValueOnce(mockFetchResponse(netResponse))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getUniswapPrice(
      tokenIn,
      tokenOut,
      '1000000000000000000',
      dispensationAmount
    )

    expect(price).toEqual({
      price: '800000000',
      outputAmountDirect: '1000000000',
      outputAmountNet: '800000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should throw error when dispensation exceeds intermediate amount', async () => {
    const tokenIn = mockToken('0x1234', 1)
    const tokenOut = mockToken('0x5678', 2)
    const dispensationAmount = '600000000000000000' // 0.6 ETH

    // First quote: tokenIn to native on chain 1
    const firstResponse = mockQuoteResponse(
      tokenIn.address,
      '0x0000000000000000000000000000000000000000',
      1,
      1,
      '1000000000000000000',
      '500000000000000000' // 0.5 ETH intermediate
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(firstResponse))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    await expect(
      provider.getUniswapPrice(
        tokenIn,
        tokenOut,
        '1000000000000000000',
        dispensationAmount
      )
    ).rejects.toThrow('Dispensation amount exceeds intermediate quote amount')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should handle cross-chain quote with non-native tokens and include direct/net amounts', async () => {
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
      .mockImplementation((url) => {
        // Return different responses based on which API call is being made
        const callCount = (global.fetch as jest.Mock).mock.calls.length;
        if (callCount === 1) {
          return Promise.resolve(mockFetchResponse(firstResponse));
        } else {
          // Both second and third calls should return the same response since there's no dispensation
          return Promise.resolve(mockFetchResponse(secondResponse));
        }
      })

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getPrice(tokenIn, tokenOut)

    expect(price).toEqual({
      price: '1000000000',
      outputAmountDirect: '1000000000',
      outputAmountNet: '1000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    // For cross-chain quotes with non-native tokens, we expect 3 fetch calls:
    // 1. tokenIn to native on chain 1
    // 2. native to tokenOut on chain 2
    // 3. native to tokenOut on chain 2 less dispensation
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should handle cross-chain quote with native token input and dispensation', async () => {
    const tokenIn = mockToken('0x0000000000000000000000000000000000000000', 1) // Native on chain 1
    const tokenOut = mockToken('0x5678', 2) // Custom token on chain 2
    const inputAmount = '1000000000000000000' // 1 ETH
    const dispensationAmount = '200000000000000000' // 0.2 ETH

    // Direct quote with full amount
    const directResponse = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      inputAmount,
      '2000000000'
    )

    // Net quote with reduced amount
    const netResponse = mockQuoteResponse(
      '0x0000000000000000000000000000000000000000',
      tokenOut.address,
      2,
      2,
      '800000000000000000', // 1 ETH - 0.2 ETH
      '1600000000'
    )

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(directResponse))
      .mockResolvedValueOnce(mockFetchResponse(netResponse))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getUniswapPrice(
      tokenIn,
      tokenOut,
      inputAmount,
      dispensationAmount
    )

    expect(price).toEqual({
      price: '1600000000',
      outputAmountDirect: '2000000000',
      outputAmountNet: '1600000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should handle cross-chain quote with native token output and dispensation', async () => {
    const tokenIn = mockToken('0x1234', 1) // Custom token on chain 1
    const tokenOut = mockToken('0x0000000000000000000000000000000000000000', 2) // Native on chain 2
    const dispensationAmount = '100000000000000000' // 0.1 ETH

    // Mock quote (tokenIn to native on chain 1)
    const response = mockQuoteResponse(
      tokenIn.address,
      '0x0000000000000000000000000000000000000000',
      1,
      1,
      '1000000000000000000',
      '500000000000000000' // 0.5 ETH
    )

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(response))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getUniswapPrice(
      tokenIn,
      tokenOut,
      '1000000000000000000',
      dispensationAmount
    )

    expect(price).toEqual({
      price: '400000000000000000', // 0.5 ETH - 0.1 ETH
      outputAmountDirect: '500000000000000000',
      outputAmountNet: '400000000000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should return input amount when both tokens are native and handle dispensation', async () => {
    const tokenIn = mockToken('0x0000000000000000000000000000000000000000', 1)
    const tokenOut = mockToken('0x0000000000000000000000000000000000000000', 2)
    const inputAmount = '1000000000000000000' // 1 ETH
    const dispensationAmount = '300000000000000000' // 0.3 ETH

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const price = await provider.getUniswapPrice(
      tokenIn,
      tokenOut,
      inputAmount,
      dispensationAmount
    )

    expect(price).toEqual({
      price: '700000000000000000', // 1 ETH - 0.3 ETH
      outputAmountDirect: '1000000000000000000',
      outputAmountNet: '700000000000000000',
      source: 'uniswap',
      timestamp: expect.any(Number),
    })

    // No fetch calls should be made for native-to-native transfers
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse('Invalid token pair'))

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

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(response))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const hasPool = await provider.hasDirectPool(tokenA, tokenB)
    expect(hasPool).toBe(true)
  })

  it('should handle non-existent pools', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse('No route found'))

    const provider = new UniswapProvider(mockConfig, silentLogger)
    const tokenA = mockToken()
    const tokenB = mockToken('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

    const hasPool = await provider.hasDirectPool(tokenA, tokenB)
    expect(hasPool).toBe(false)
  })
})

import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import {
  IUniswapProvider,
  UniswapConfig,
} from '../interfaces/IUniswapProvider.js'
import {
  IndicativeQuoteRequest,
  IndicativeQuoteResponse,
} from '../types/uniswap.js'
import { Logger } from '../../../utils/logger.js'

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'

export class UniswapProvider implements IUniswapProvider {
  private config: UniswapConfig
  private logger: Logger

  constructor(
    config: UniswapConfig,
    logger: Logger = new Logger('UniswapProvider')
  ) {
    this.config = config
    this.logger = logger
  }

  private async fetchIndicativeQuote(
    tokenIn: Token,
    tokenOut: Token,
    amount: string,
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT' = 'EXACT_INPUT'
  ): Promise<IndicativeQuoteResponse> {
    const request: IndicativeQuoteRequest = {
      type,
      tokenInChainId: tokenIn.chainId,
      tokenOutChainId: tokenOut.chainId,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amount,
    }

    this.logger.info(
      `Sending request to Uniswap API: ${JSON.stringify(request)}`
    )

    const response = await fetch(`${this.config.apiUrl}/v1/indicative_quote`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Uniswap API error: ${error}`)
    }

    const data = (await response.json()) as IndicativeQuoteResponse
    this.logger.info(
      `Received response from Uniswap API: ${JSON.stringify(data)}`
    )
    return data
  }

  async hasDirectPool(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      // Try to get a quote for a small amount to check if the pair exists
      await this.fetchIndicativeQuote(tokenA, tokenB, '1000000') // 1 USDC worth
      return true
    } catch (error) {
      this.logger.error(`Error checking pool existence: ${error}`)
      return false
    }
  }

  async getPrice(tokenIn: Token, tokenOut: Token): Promise<PriceData> {
    return this.getUniswapPrice(tokenIn, tokenOut)
  }

  async supportsPair(tokenA: Token, tokenB: Token): Promise<boolean> {
    return this.hasDirectPool(tokenA, tokenB)
  }

  async getUniswapPrice(
    tokenIn: Token,
    tokenOut: Token,
    amount?: string
  ): Promise<PriceData & { poolAddress?: string; liquidity?: string }> {
    try {
      // Use 1 ETH as the default amount if not specified
      const defaultAmount = '1000000000000000000' // 1 ETH in wei
      const inputAmount = amount || defaultAmount

      // If both tokens are native (address(0)), return the input amount as is
      if (
        tokenIn.address === NATIVE_TOKEN &&
        tokenOut.address === NATIVE_TOKEN
      ) {
        return {
          price: inputAmount,
          source: 'uniswap',
          timestamp: Date.now(),
        }
      }

      // If on different chains, handle cross-chain quote
      if (tokenIn.chainId !== tokenOut.chainId) {
        return this.getCrossChainPrice(tokenIn, tokenOut, inputAmount)
      }

      // Same chain quote
      const quote = await this.fetchIndicativeQuote(
        tokenIn,
        tokenOut,
        inputAmount
      )

      if (!quote?.output?.amount) {
        throw new Error('Invalid quote response from Uniswap API')
      }

      return {
        price: quote.output.amount,
        source: 'uniswap',
        timestamp: Date.now(),
      }
    } catch (error) {
      this.logger.error(`Error fetching Uniswap price: ${error}`)
      throw error
    }
  }

  private async getCrossChainPrice(
    tokenIn: Token,
    tokenOut: Token,
    amount: string
  ): Promise<PriceData & { poolAddress?: string; liquidity?: string }> {
    // Create native token objects for both chains
    const nativeTokenIn: Token = {
      ...tokenIn,
      address: NATIVE_TOKEN,
    }
    const nativeTokenOut: Token = {
      ...tokenOut,
      address: NATIVE_TOKEN,
    }

    let firstQuoteAmount: string | undefined
    let secondQuoteAmount: string | undefined

    // Handle input side if not native
    if (tokenIn.address !== NATIVE_TOKEN) {
      const inputQuote = await this.fetchIndicativeQuote(
        tokenIn,
        nativeTokenIn,
        amount
      )
      firstQuoteAmount = inputQuote.output.amount
    } else {
      firstQuoteAmount = amount
    }

    // Handle output side if not native
    if (tokenOut.address !== NATIVE_TOKEN) {
      const outputQuote = await this.fetchIndicativeQuote(
        nativeTokenOut,
        tokenOut,
        firstQuoteAmount
      )
      secondQuoteAmount = outputQuote.output.amount
    } else {
      secondQuoteAmount = firstQuoteAmount
    }

    if (!secondQuoteAmount) {
      throw new Error('Failed to calculate cross-chain quote')
    }

    return {
      price: secondQuoteAmount,
      source: 'uniswap',
      timestamp: Date.now(),
    }
  }
}

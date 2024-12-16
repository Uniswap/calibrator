import {
  IPriceProvider,
  PriceData,
  Token,
} from './interfaces/IPriceProvider.js'
import {
  PriceServiceConfig,
  ValidatedPriceData,
  PriceQuoteRequest,
  PriceQuoteResponse,
} from './types.js'
import { Logger } from '../../utils/logger.js'

export class PriceService {
  private providers: IPriceProvider[]
  private config: PriceServiceConfig
  private logger: Logger

  constructor(
    providers: IPriceProvider[],
    config: PriceServiceConfig,
    logger: Logger = new Logger('PriceService')
  ) {
    this.providers = providers
    this.config = config
    this.logger = logger
  }

  /**
   * Get a validated price quote for a token pair
   */
  async getQuote(request: PriceQuoteRequest): Promise<PriceQuoteResponse> {
    const { tokenIn, tokenOut, amountIn, maxSlippage = 0.01 } = request

    // Get prices from all supported providers
    const prices = await this.getPricesFromProviders(tokenIn, tokenOut)

    if (prices.length < this.config.minSourcesRequired) {
      throw new Error(
        `Insufficient price sources. Required: ${this.config.minSourcesRequired}, Found: ${prices.length}`
      )
    }

    // Validate prices and calculate aggregate
    const validatedPrice = this.validateAndAggregatePrices(prices)

    // Calculate estimated output if amount is provided
    const estimatedOut = amountIn
      ? this.calculateEstimatedOutput(amountIn, validatedPrice.price)
      : undefined

    return {
      price: validatedPrice,
      estimatedOut,
      maxSlippage,
      expiresAt: Date.now() + this.config.cacheDurationMs,
    }
  }

  private async getPricesFromProviders(
    tokenA: Token,
    tokenB: Token
  ): Promise<PriceData[]> {
    const prices: PriceData[] = []

    for (const provider of this.providers) {
      try {
        if (await provider.supportsPair(tokenA, tokenB)) {
          const price = await provider.getPrice(tokenA, tokenB)
          prices.push(price)
        }
      } catch (error) {
        this.logger.error(`Error fetching price from provider: ${error}`)
      }
    }

    return prices
  }

  private validateAndAggregatePrices(prices: PriceData[]): ValidatedPriceData {
    if (prices.length === 0) {
      throw new Error('No prices available')
    }

    // Calculate average price
    const sum = prices.reduce((acc, curr) => acc + Number(curr.price), 0)
    const avgPrice = sum / prices.length

    // Check deviations
    let maxDeviation = 0
    for (const price of prices) {
      const deviation = Math.abs(Number(price.price) - avgPrice) / avgPrice
      if (deviation > this.config.maxPriceDeviation) {
        throw new Error(
          `Price deviation too high. Max: ${this.config.maxPriceDeviation}, Found: ${deviation}`
        )
      }
      maxDeviation = Math.max(maxDeviation, deviation)
    }

    // Get max decimal places from input prices
    const maxDecimals = Math.max(
      ...prices.map(p => p.price.split('.')[1]?.length || 0)
    )

    return {
      price: avgPrice.toFixed(maxDecimals),
      timestamp: Math.min(...prices.map(p => p.timestamp)),
      source: 'aggregate',
      sourceCount: prices.length,
      maxDeviation,
      sources: prices.map(p => p.source),
    }
  }

  private calculateEstimatedOutput(amountIn: string, price: string): string {
    return (Number(amountIn) * Number(price)).toString()
  }
}

import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import {
  ICoinGeckoProvider,
  CoinGeckoConfig,
} from '../interfaces/ICoinGeckoProvider.js'

export class CoinGeckoProvider implements ICoinGeckoProvider {
  private config: CoinGeckoConfig
  private cache: Map<string, { data: PriceData; timestamp: number }>
  private platformCache: string[] | null = null

  constructor(config: CoinGeckoConfig) {
    this.config = config
    this.cache = new Map()
  }

  async getUsdPrice(_token: Token): Promise<PriceData> {
    // TODO: Implement actual CoinGecko API integration
    throw new Error('CoinGecko price fetching not yet implemented')
  }

  async getSupportedPlatforms(): Promise<string[]> {
    // TODO: Implement platform fetching
    throw new Error('Platform fetching not yet implemented')
  }

  async getPrice(_tokenA: Token, _tokenB: Token): Promise<PriceData> {
    // Get USD prices for both tokens and calculate the relative price
    const tokenAPrice = await this.getUsdPrice(_tokenA)
    const tokenBPrice = await this.getUsdPrice(_tokenB)

    const relativePrice = (
      Number(tokenBPrice.price) / Number(tokenAPrice.price)
    ).toString()

    return {
      price: relativePrice,
      timestamp: Math.min(tokenAPrice.timestamp, tokenBPrice.timestamp),
      source: 'coingecko',
    }
  }

  async supportsPair(_tokenA: Token, _tokenB: Token): Promise<boolean> {
    try {
      const platforms = await this.getSupportedPlatforms()
      return (
        platforms.includes(_tokenA.chainId.toString()) &&
        platforms.includes(_tokenB.chainId.toString())
      )
    } catch {
      return false
    }
  }

  private getCacheKey(token: Token): string {
    return `${token.chainId}-${token.address}`
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.cacheDurationMs
  }
}

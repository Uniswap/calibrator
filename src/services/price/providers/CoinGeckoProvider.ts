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

  async getUsdPrice(token: Token): Promise<PriceData> {
    // Check cache first
    const cacheKey = `${token.chainId}-${token.address}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.config.cacheDurationMs) {
      return cached.data
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
    }

    if (this.config.apiKey) {
      headers['x-cg-pro-api-key'] = this.config.apiKey
    }

    const baseUrl = this.config.apiKey
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3'

    // Special case for ETH (address(0))
    if (token.address === '0x0000000000000000000000000000000000000000') {
      const response = await fetch(
        `${baseUrl}/simple/price?ids=ethereum&vs_currencies=usd`,
        { headers }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch ETH price: ${response.statusText}`)
      }

      const data = (await response.json()) as { ethereum?: { usd: number } }

      if (!data.ethereum?.usd) {
        throw new Error('Invalid response format for ETH price')
      }

      const price = data.ethereum.usd.toString()
      const timestamp = Date.now()

      const priceData = {
        price,
        timestamp,
        source: 'coingecko',
      }

      // Update cache
      this.cache.set(cacheKey, { data: priceData, timestamp })

      return priceData
    }

    // Handle other ERC20 tokens
    if (token.chainId === 1) {
      // Ethereum mainnet
      const response = await fetch(
        `${baseUrl}/simple/token_price/ethereum?contract_addresses=${token.address}&vs_currencies=usd`,
        { headers }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch token price: ${response.statusText}`)
      }

      const data = (await response.json()) as Record<
        string,
        { usd: number } | undefined
      >
      const price = data[token.address.toLowerCase()]?.usd

      if (!price) {
        throw new Error(`No price data available for token ${token.address}`)
      }

      const priceData = {
        price: price.toString(),
        timestamp: Date.now(),
        source: 'coingecko',
      }

      // Update cache
      this.cache.set(cacheKey, { data: priceData, timestamp: Date.now() })

      return priceData
    }

    throw new Error(`Unsupported chain ID: ${token.chainId}`)
  }

  async getSupportedPlatforms(): Promise<string[]> {
    // TODO: Implement platform fetching
    throw new Error('Platform fetching not yet implemented')
  }

  async getPrice(tokenA: Token, tokenB: Token): Promise<PriceData> {
    // Get USD prices for both tokens and calculate the relative price
    const tokenAPrice = await this.getUsdPrice(tokenA)
    const tokenBPrice = await this.getUsdPrice(tokenB)

    const relativePrice = (
      Number(tokenBPrice.price) / Number(tokenAPrice.price)
    ).toString()

    return {
      price: relativePrice,
      timestamp: Math.min(tokenAPrice.timestamp, tokenBPrice.timestamp),
      source: 'coingecko',
    }
  }

  async supportsPair(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      const platforms = await this.getSupportedPlatforms()
      return (
        platforms.includes(tokenA.chainId.toString()) &&
        platforms.includes(tokenB.chainId.toString())
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

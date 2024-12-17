import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import {
  ICoinGeckoProvider,
  CoinGeckoConfig,
} from '../interfaces/ICoinGeckoProvider.js'
import { Logger } from '../../../utils/logger.js'

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'

class CoinGeckoError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'CoinGeckoError'
  }
}

export class CoinGeckoProvider implements ICoinGeckoProvider {
  private config: CoinGeckoConfig
  private cache: Map<string, { data: PriceData; timestamp: number }>
  private platformCache: string[] | null = null
  private logger: Logger
  private baseUrl: string
  private headers: Record<string, string>

  constructor(config: CoinGeckoConfig) {
    this.config = config
    this.cache = new Map()
    this.logger = new Logger('CoinGeckoProvider')
    this.baseUrl = config.apiKey
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3'
    this.headers = {
      accept: 'application/json',
    }
    if (config.apiKey) {
      this.headers['x-cg-pro-api-key'] = config.apiKey
    }
  }

  private async makeRequest<T>(url: string, errorContext: string): Promise<T> {
    try {
      const response = await fetch(url, { headers: this.headers })

      if (!response.ok) {
        let errorMessage: string
        try {
          const errorData = await response.json()
          if (
            errorData &&
            typeof errorData === 'object' &&
            'error' in errorData &&
            typeof errorData.error === 'string'
          ) {
            errorMessage = errorData.error
          } else {
            errorMessage = response.statusText
          }
        } catch {
          errorMessage = response.statusText
        }

        throw new CoinGeckoError(
          `${errorContext}: ${errorMessage} (${response.status})`
        )
      }

      const data = await response.json()
      if (!data) {
        throw new CoinGeckoError(`${errorContext}: Empty response`)
      }

      return data as T
    } catch (error) {
      if (error instanceof CoinGeckoError) {
        throw error
      }
      throw new CoinGeckoError(
        `${errorContext}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      )
    }
  }

  private validateEthPriceResponse(
    data: unknown
  ): asserts data is { ethereum: { usd: number } } {
    if (!data || typeof data !== 'object') {
      throw new CoinGeckoError(
        'Invalid ETH price response format: not an object'
      )
    }

    const { ethereum } = data as { ethereum?: { usd?: unknown } }
    if (!ethereum?.usd || typeof ethereum.usd !== 'number') {
      throw new CoinGeckoError(
        'Invalid ETH price response format: missing or invalid price'
      )
    }
  }

  private validateTokenPriceResponse(
    data: unknown,
    address: string
  ): asserts data is Record<string, { usd: number }> {
    if (!data || typeof data !== 'object') {
      throw new CoinGeckoError(
        'Invalid token price response format: not an object'
      )
    }

    const price = (data as Record<string, { usd?: unknown }>)[
      address.toLowerCase()
    ]?.usd
    if (price === undefined || typeof price !== 'number') {
      throw new CoinGeckoError(`No price data available for token ${address}`)
    }
  }

  async getUsdPrice(token: Token): Promise<PriceData> {
    this.logger.info(
      `Getting USD price for token ${token.address} on chain ${token.chainId}`
    )

    // Check cache first
    const cacheKey = `${token.chainId}-${token.address}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.config.cacheDurationMs) {
      this.logger.info(
        `Using cached price for ${cacheKey}: ${cached.data.price}`
      )
      return cached.data
    }

    try {
      if (token.chainId !== 1) {
        throw new CoinGeckoError(`Unsupported chain ID: ${token.chainId}`)
      }

      if (token.address === ETH_ADDRESS) {
        this.logger.info('Fetching ETH price')
        const url = `${this.baseUrl}/simple/price?ids=ethereum&vs_currencies=usd`
        this.logger.info(`CoinGecko request URL: ${url}`)

        const data = await this.makeRequest<unknown>(
          url,
          'Failed to fetch ETH price'
        )
        this.validateEthPriceResponse(data)
        this.logger.info(`Received ETH price data: ${JSON.stringify(data)}`)

        const timestamp = Date.now()
        const priceData = {
          price: this.convertUsdToWei(data.ethereum.usd),
          timestamp,
          source: 'coingecko',
        }

        // Update cache
        this.cache.set(cacheKey, { data: priceData, timestamp })
        return priceData
      } else {
        this.logger.info(`Fetching price for token ${token.address}`)
        const url = `${this.baseUrl}/simple/token_price/ethereum?contract_addresses=${token.address}&vs_currencies=usd`
        this.logger.info(`CoinGecko request URL: ${url}`)

        const data = await this.makeRequest<unknown>(
          url,
          'Failed to fetch token price'
        )
        this.validateTokenPriceResponse(data, token.address)
        this.logger.info(`Received token price data: ${JSON.stringify(data)}`)

        const price = data[token.address.toLowerCase()].usd
        const timestamp = Date.now()
        const priceData = {
          price: this.convertUsdToWei(price),
          timestamp,
          source: 'coingecko',
        }

        // Update cache
        this.cache.set(cacheKey, { data: priceData, timestamp })
        return priceData
      }
    } catch (error) {
      this.logger.error(`Error getting price: ${error}`)
      throw error
    }
  }

  private convertUsdToWei(usdPrice: number): string {
    // Convert USD price to wei (18 decimals)
    // First multiply by 1e18 to get the full integer representation
    const priceInWei = BigInt(Math.floor(usdPrice * 1e18))
    return priceInWei.toString()
  }

  async getPrice(tokenA: Token, tokenB: Token): Promise<PriceData> {
    this.logger.info(`Getting price for ${tokenA.address}/${tokenB.address}`)
    try {
      const priceA = await this.getUsdPrice(tokenA)
      const priceB = await this.getUsdPrice(tokenB)

      this.logger.info(`Token A (${tokenA.address}) price: ${priceA.price}`)
      this.logger.info(`Token B (${tokenB.address}) price: ${priceB.price}`)

      // Calculate price of tokenA in terms of tokenB
      const priceABigInt = BigInt(priceA.price)
      const priceBBigInt = BigInt(priceB.price)

      const price = ((priceABigInt * BigInt(1e18)) / priceBBigInt).toString()

      this.logger.info(
        `Calculated price ${tokenA.address}/${tokenB.address}: ${price}`
      )
      return {
        price,
        timestamp: Date.now(),
        source: 'coingecko',
      }
    } catch (error) {
      this.logger.error(`Error getting price: ${error}`)
      throw error
    }
  }

  async supportsPair(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      await this.getPrice(tokenA, tokenB)
      return true
    } catch {
      return false
    }
  }

  async getSupportedPlatforms(): Promise<string[]> {
    if (this.platformCache) {
      return this.platformCache
    }

    try {
      const data = await this.makeRequest<Array<{ id: string }>>(
        `${this.baseUrl}/asset_platforms`,
        'Failed to fetch supported platforms'
      )

      if (!Array.isArray(data)) {
        throw new CoinGeckoError(
          'Invalid platforms response format: not an array'
        )
      }

      this.platformCache = data.map(platform => platform.id)
      return this.platformCache
    } catch (error) {
      this.logger.error(`Error fetching supported platforms: ${error}`)
      throw error
    }
  }
}

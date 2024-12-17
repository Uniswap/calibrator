import { Token } from './interfaces/IPriceProvider.js'
import { CoinGeckoProvider } from './providers/CoinGeckoProvider.js'
import { UniswapProvider } from './providers/UniswapProvider.js'
import { CoinGeckoAssetPlatform, ChainMapping } from './types/coingecko.js'
import { QuoteRequest, QuoteResponse } from './types/quote.js'
import { Logger } from '../../utils/logger.js'

interface TokenInfo {
  decimals: number
  symbol: string
  timestamp: number
}

interface CoinGeckoTokenResponse {
  detail_platforms: {
    [key: string]: {
      decimal_place: number
    }
  }
  symbol: string
}

export class QuoteService {
  private chainMapping: ChainMapping = {}
  private coinGeckoProvider: CoinGeckoProvider
  private uniswapProvider: UniswapProvider
  private logger: Logger
  private tokenInfoCache: Map<string, TokenInfo>
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  constructor(
    coinGeckoProvider: CoinGeckoProvider,
    uniswapProvider: UniswapProvider,
    logger: Logger = new Logger('QuoteService')
  ) {
    this.coinGeckoProvider = coinGeckoProvider
    this.uniswapProvider = uniswapProvider
    this.logger = logger
    this.tokenInfoCache = new Map()
  }

  private getCacheKey(address: string, chainId: number): string {
    return `${chainId}:${address.toLowerCase()}`
  }

  private async getTokenInfo(
    address: string,
    chainId: number
  ): Promise<TokenInfo> {
    const cacheKey = this.getCacheKey(address, chainId)
    const now = Date.now()
    const cached = this.tokenInfoCache.get(cacheKey)

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      this.logger.info(`Using cached token info for ${address}`)
      return cached
    }

    try {
      if (address === '0x0000000000000000000000000000000000000000') {
        const info = { decimals: 18, symbol: 'ETH', timestamp: now }
        this.tokenInfoCache.set(cacheKey, info)
        return info
      }

      const platform = this.getChainPlatform(chainId)
      const platforms = await this.coinGeckoProvider.getSupportedPlatforms()

      if (!platforms.includes(platform)) {
        throw new Error(`Unsupported platform: ${platform}`)
      }

      this.logger.info(
        `Fetching token info from CoinGecko for platform ${platform}`
      )
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch token info: ${response.statusText}`)
      }

      const data = (await response.json()) as CoinGeckoTokenResponse

      if (!data.detail_platforms?.[platform]?.decimal_place || !data.symbol) {
        throw new Error('Invalid token info response format')
      }

      const info = {
        decimals: data.detail_platforms[platform].decimal_place,
        symbol: data.symbol.toUpperCase(),
        timestamp: now,
      }

      this.logger.info(
        `Token ${address} info from CoinGecko - decimals: ${info.decimals}, symbol: ${info.symbol}`
      )
      this.tokenInfoCache.set(cacheKey, info)
      return info
    } catch (error) {
      this.logger.error(`Error fetching token info for ${address}: ${error}`)
      throw error
    }
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(
        'https://pro-api.coingecko.com/api/v3/asset_platforms',
        {
          headers: {
            accept: 'application/json',
            'x-cg-pro-api-key': process.env.COINGECKO_API_KEY || '',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch asset platforms')
      }

      const platforms = (await response.json()) as CoinGeckoAssetPlatform[]
      this.logger.info(
        `Fetched ${platforms.length} asset platforms from CoinGecko`
      )

      this.chainMapping = platforms.reduce((acc, platform) => {
        if (platform.chain_identifier !== null) {
          acc[platform.chain_identifier] = platform.id
        }
        return acc
      }, {} as ChainMapping)

      this.logger.info(
        `Initialized chain mapping with ${Object.keys(this.chainMapping).length} chains`
      )
    } catch (error) {
      this.logger.error(`Failed to initialize chain mapping: ${error}`)
      throw error
    }
  }

  private getChainPlatform(chainId: number): string {
    const platform = this.chainMapping[chainId]
    if (!platform) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }
    return platform
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const {
      inputTokenChainId,
      inputTokenAddress,
      inputTokenAmount,
      outputTokenChainId,
      outputTokenAddress,
    } = request

    this.logger.info(`Getting quote for request: ${JSON.stringify(request)}`)

    // Fetch token information from CoinGecko
    const [inputTokenInfo, outputTokenInfo] = await Promise.all([
      this.getTokenInfo(inputTokenAddress, inputTokenChainId),
      this.getTokenInfo(outputTokenAddress, outputTokenChainId),
    ])

    // Create token objects with correct decimals
    const inputToken: Token = {
      address: inputTokenAddress,
      chainId: inputTokenChainId,
      decimals: inputTokenInfo.decimals,
      symbol: inputTokenInfo.symbol,
    }

    const outputToken: Token = {
      address: outputTokenAddress,
      chainId: outputTokenChainId,
      decimals: outputTokenInfo.decimals,
      symbol: outputTokenInfo.symbol,
    }

    this.logger.info(
      `Input token: ${inputToken.symbol} (${inputToken.decimals} decimals)`
    )
    this.logger.info(
      `Output token: ${outputToken.symbol} (${outputToken.decimals} decimals)`
    )

    let spotOutputAmount: string | null = null
    let quoteOutputAmount: string | null = null
    let deltaAmount: string | null = null

    try {
      this.logger.info('Getting spot prices from CoinGecko')
      // Get spot prices from CoinGecko
      const [inputPrice, outputPrice] = await Promise.all([
        this.coinGeckoProvider.getUsdPrice(inputToken),
        this.coinGeckoProvider.getUsdPrice(outputToken),
      ])

      this.logger.info(`Input token USD price: ${inputPrice.price}`)
      this.logger.info(`Output token USD price: ${outputPrice.price}`)

      if (inputPrice && outputPrice) {
        // Calculate spot output amount
        // First calculate the input value in USD (18 decimals)
        const inputValueUsd =
          (BigInt(inputPrice.price) * BigInt(inputTokenAmount)) /
          BigInt(10n ** BigInt(inputToken.decimals))
        this.logger.info(`Input value in USD: ${inputValueUsd}`)

        // Then convert USD value to output token amount with correct decimals
        const outputTokensSpot =
          (inputValueUsd * BigInt(10n ** BigInt(outputToken.decimals))) /
          BigInt(outputPrice.price)
        this.logger.info(`Output tokens spot: ${outputTokensSpot}`)

        spotOutputAmount = outputTokensSpot.toString()
      }
    } catch (error) {
      this.logger.error(`Error fetching spot prices: ${error}`)
    }

    try {
      this.logger.info('Getting Uniswap quote')
      // Get Uniswap quote (will be in output token's decimals)
      const quote = await this.uniswapProvider.getUniswapPrice(
        inputToken,
        outputToken,
        inputTokenAmount
      )
      quoteOutputAmount = quote.price
      this.logger.info(`Uniswap quote amount: ${quoteOutputAmount}`)
    } catch (error) {
      this.logger.error(`Error fetching Uniswap quote: ${error}`)
    }

    // Calculate delta if both prices are available
    if (spotOutputAmount !== null && quoteOutputAmount !== null) {
      // Both amounts are in output token's decimals
      const delta = BigInt(quoteOutputAmount) - BigInt(spotOutputAmount)
      deltaAmount = delta.toString()
      this.logger.info(`Calculated delta: ${deltaAmount}`)
    } else {
      this.logger.error(
        `Could not calculate delta: spotOutputAmount=${spotOutputAmount}, quoteOutputAmount=${quoteOutputAmount}`
      )
    }

    return {
      ...request,
      spotOutputAmount,
      quoteOutputAmount,
      deltaAmount,
    }
  }
}

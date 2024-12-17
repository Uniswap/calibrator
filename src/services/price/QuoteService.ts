import { Token } from './interfaces/IPriceProvider.js'
import { CoinGeckoProvider } from './providers/CoinGeckoProvider.js'
import { UniswapProvider } from './providers/UniswapProvider.js'
import { CoinGeckoAssetPlatform, ChainMapping } from './types/coingecko.js'
import { QuoteRequest, QuoteResponse } from './types/quote.js'
import { Logger } from '../../utils/logger.js'

export class QuoteService {
  private chainMapping: ChainMapping = {}
  private coinGeckoProvider: CoinGeckoProvider
  private uniswapProvider: UniswapProvider
  private logger: Logger

  constructor(
    coinGeckoProvider: CoinGeckoProvider,
    uniswapProvider: UniswapProvider,
    logger: Logger = new Logger('QuoteService')
  ) {
    this.coinGeckoProvider = coinGeckoProvider
    this.uniswapProvider = uniswapProvider
    this.logger = logger
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

      // Filter out platforms with null chain_identifier and create mapping
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

    // Validate chain IDs before proceeding
    if (!this.chainMapping[inputTokenChainId]) {
      throw new Error(`Unsupported chain ID: ${inputTokenChainId}`)
    }
    if (!this.chainMapping[outputTokenChainId]) {
      throw new Error(`Unsupported chain ID: ${outputTokenChainId}`)
    }

    // Create token objects
    const inputToken: Token = {
      address: inputTokenAddress,
      chainId: inputTokenChainId,
      decimals: 18, // TODO: Fetch actual decimals
      symbol: '', // TODO: Fetch actual symbol
    }

    const outputToken: Token = {
      address: outputTokenAddress,
      chainId: outputTokenChainId,
      decimals: 18, // TODO: Fetch actual decimals
      symbol: '', // TODO: Fetch actual symbol
    }

    let spotOutputAmount: string | null = null
    let quoteOutputAmount: string | null = null
    let deltaAmount: string | null = null

    try {
      // Get spot prices from CoinGecko
      const [inputPrice, outputPrice] = await Promise.all([
        this.coinGeckoProvider.getPrice(inputToken, {
          address: 'usd',
          chainId: 1,
          decimals: 8,
          symbol: 'USD',
        }),
        this.coinGeckoProvider.getPrice(outputToken, {
          address: 'usd',
          chainId: 1,
          decimals: 8,
          symbol: 'USD',
        }),
      ])

      if (inputPrice && outputPrice) {
        // Calculate spot output amount in wei (18 decimals)
        const inputValueUsd =
          (BigInt(inputPrice.price) * BigInt(inputTokenAmount)) /
          BigInt(10n ** 18n)
        const outputTokensSpot =
          (inputValueUsd * BigInt(10n ** 18n)) / BigInt(outputPrice.price)
        spotOutputAmount = outputTokensSpot.toString()
      }
    } catch (error) {
      this.logger.error(`Error fetching spot prices: ${error}`)
    }

    try {
      // Get Uniswap quote
      const quote = await this.uniswapProvider.getUniswapPrice(
        inputToken,
        outputToken,
        inputTokenAmount
      )
      quoteOutputAmount = quote.price
    } catch (error) {
      this.logger.error(`Error fetching Uniswap quote: ${error}`)
    }

    // Calculate delta if both prices are available
    if (spotOutputAmount !== null && quoteOutputAmount !== null) {
      const delta = BigInt(quoteOutputAmount) - BigInt(spotOutputAmount)
      deltaAmount = delta.toString()
    }

    return {
      ...request,
      spotOutputAmount,
      quoteOutputAmount,
      deltaAmount,
    }
  }
}

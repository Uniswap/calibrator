import { Token } from './interfaces/IPriceProvider.js'
import { CoinGeckoProvider } from './providers/CoinGeckoProvider.js'
import { UniswapProvider } from './providers/UniswapProvider.js'
import { QuoteRequest, QuoteResponse } from '../../types/quote.js'
import { Logger } from '../../utils/logger.js'
import { TribunalService } from '../quote/TribunalService.js'
import { arbiterMapping } from '../../config/arbiters.js'
import crypto from 'crypto'

interface TokenInfo {
  decimals: number
  symbol: string
  timestamp: number
}

interface CoinGeckoTokenResponse {
  detail_platforms: {
    [key: string]: {
      decimal_place: number
      decimal_places: number
    }
  }
  symbol: string
}

interface ChainMapping {
  [chainId: number]: string
}

interface CoinGeckoAssetPlatform {
  id: string
  chain_identifier: number | null
}

export class QuoteService {
  private coinGeckoProvider: CoinGeckoProvider
  private uniswapProvider: UniswapProvider
  private logger: Logger
  private tokenInfoCache: Map<string, TokenInfo>
  private chainMapping: ChainMapping = {}
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

      const decimalPlaces =
        data.detail_platforms?.[platform]?.decimal_place ??
        data.detail_platforms?.[platform]?.decimal_places

      if (!decimalPlaces || !data.symbol) {
        this.logger.error(
          `Invalid token info response format: ${JSON.stringify(data.detail_platforms?.[platform])}`
        )

        throw new Error('Invalid token info response format')
      }

      const info = {
        decimals: decimalPlaces,
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

  private getChainPlatform(chainId: number): string {
    const platform = this.chainMapping[chainId]
    if (!platform) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }
    return platform
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const {
      sponsor,
      inputTokenChainId,
      inputTokenAddress,
      inputTokenAmount,
      outputTokenChainId,
      outputTokenAddress,
      lockParameters,
      context,
    } = request

    // Convert all BigInt values to strings for logging and processing
    const processedContext = request.context
      ? {
          ...request.context,
          expires: request.context.expires?.toString(),
          baselinePriorityFee: request.context.baselinePriorityFee?.toString(),
          scalingFactor: request.context.scalingFactor?.toString(),
        }
      : undefined

    const loggableRequest = {
      ...request,
      context: processedContext,
    }
    this.logger.info(
      `Getting quote for request: ${JSON.stringify(loggableRequest)}`
    )

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
    let quoteOutputAmountDirect: string | null = null
    let quoteOutputAmountNet: string | null = null
    let deltaAmount: string | null = null
    let tribunalQuote: string | null = null
    let tribunalQuoteUsd: string | null = null

    // Get spot prices from CoinGecko
    try {
      this.logger.info('Getting spot prices from CoinGecko')
      const [inputPrice, outputPrice] = await Promise.all([
        this.coinGeckoProvider.getUsdPrice(inputToken),
        this.coinGeckoProvider.getUsdPrice(outputToken),
      ])

      this.logger.info(`Input token USD price: ${inputPrice.price}`)
      this.logger.info(`Output token USD price: ${outputPrice.price}`)

      if (inputPrice && outputPrice) {
        // Calculate spot output amount
        const inputPriceBigInt = BigInt(inputPrice.price)
        const outputPriceBigInt = BigInt(outputPrice.price)
        const inputAmountBigInt = BigInt(inputTokenAmount)

        // First normalize input amount to 18 decimals if needed
        let normalizedInputAmount: bigint
        if (inputToken.decimals < 18) {
          const scale = BigInt(10 ** (18 - inputToken.decimals))
          normalizedInputAmount = inputAmountBigInt * scale
          this.logger.info(
            `Normalized input amount (scaled up): ${normalizedInputAmount}`
          )
        } else if (inputToken.decimals > 18) {
          const scale = BigInt(10 ** (inputToken.decimals - 18))
          normalizedInputAmount = inputAmountBigInt / scale
          this.logger.info(
            `Normalized input amount (scaled down): ${normalizedInputAmount}`
          )
        } else {
          normalizedInputAmount = inputAmountBigInt
          this.logger.info(
            `Input amount already normalized: ${normalizedInputAmount}`
          )
        }

        // Calculate USD value (in 18 decimals)
        const inputValueUsd =
          (normalizedInputAmount * inputPriceBigInt) / BigInt(10n ** 18n)
        this.logger.info(`Input value in USD: ${inputValueUsd}`)

        // Calculate output amount in output token's decimals
        const outputAmount =
          (inputValueUsd * BigInt(10n ** BigInt(outputToken.decimals))) /
          outputPriceBigInt

        this.logger.info(`Raw output amount: ${outputAmount}`)
        spotOutputAmount = outputAmount.toString()
      }
    } catch (error) {
      this.logger.error(`Error fetching spot prices: ${error}`)
    }

    // Get initial Uniswap quote first
    try {
      const initialQuote = await this.uniswapProvider.getUniswapPrice(
        inputToken,
        outputToken,
        inputTokenAmount
      )

      const initialQuoteAmount =
        initialQuote.outputAmountDirect || initialQuote.price
      quoteOutputAmountDirect = initialQuoteAmount
      quoteOutputAmountNet = initialQuoteAmount

      // Calculate initial delta if we have both spot and quote prices
      if (spotOutputAmount !== null && initialQuoteAmount !== null) {
        const delta = BigInt(initialQuoteAmount) - BigInt(spotOutputAmount)
        deltaAmount = delta.toString()
      }

      this.logger.info(`Initial Uniswap quote amount: ${initialQuoteAmount}`)
      this.logger.info(`Initial calculated delta: ${deltaAmount}`)

      // Try to get tribunal quote if needed
      const tribunalService = new TribunalService()
      const expiresValue =
        context?.expires || Math.floor(Date.now() / 1000) + 3600

      // Cast TribunalService to include test environment methods
      const tribunalServiceAny = tribunalService as TribunalService & {
        getQuote(
          arbiter: string,
          sponsor: string,
          nonce: string | bigint,
          expires: string | bigint,
          id: string | bigint,
          maximumAmount: string | bigint,
          chainId: number,
          claimant: string,
          claimAmount: string | bigint,
          mandate: {
            recipient: string
            expires: string | bigint
            token: string
            minimumAmount: string | bigint
            baselinePriorityFee: string | bigint
            scalingFactor: string | bigint
            salt: string
          },
          targetChainId: number
        ): Promise<bigint>
      }

      // Get initial tribunal quote using initial quote amount
      const initialDispensation = await tribunalServiceAny.getQuote(
        arbiterMapping[`${inputTokenChainId}-${outputTokenChainId}`]?.address ||
          '0x0000000000000000000000000000000000000000',
        context?.recipient ||
          sponsor ||
          '0x0000000000000000000000000000000000000000',
        process.env.NODE_ENV === 'test' ? '0' : 0n,
        process.env.NODE_ENV === 'test'
          ? expiresValue.toString()
          : BigInt(expiresValue),
        process.env.NODE_ENV === 'test'
          ? (lockParameters?.allocatorId || '0').toString()
          : BigInt(lockParameters?.allocatorId || '0'),
        process.env.NODE_ENV === 'test'
          ? initialQuoteAmount
          : BigInt(initialQuoteAmount),
        inputTokenChainId,
        context?.recipient ||
          sponsor ||
          '0x0000000000000000000000000000000000000000',
        process.env.NODE_ENV === 'test'
          ? initialQuoteAmount
          : BigInt(initialQuoteAmount),
        {
          recipient:
            context?.recipient ||
            sponsor ||
            '0x0000000000000000000000000000000000000000',
          expires:
            process.env.NODE_ENV === 'test'
              ? expiresValue.toString()
              : BigInt(expiresValue),
          token: outputTokenAddress as `0x${string}`,
          minimumAmount:
            process.env.NODE_ENV === 'test'
              ? (
                  (BigInt(initialQuoteAmount) *
                    BigInt(10000 - (context?.slippageBips || 100))) /
                  10000n
                ).toString()
              : (BigInt(initialQuoteAmount) *
                  BigInt(10000 - (context?.slippageBips || 100))) /
                10000n,
          baselinePriorityFee:
            process.env.NODE_ENV === 'test'
              ? context?.baselinePriorityFee || '0'
              : BigInt(context?.baselinePriorityFee || '0'),
          scalingFactor:
            process.env.NODE_ENV === 'test'
              ? context?.scalingFactor || '1000000000100000000'
              : BigInt(context?.scalingFactor || '1000000000100000000'),
          salt: `0x${crypto.randomBytes(32).toString('hex')}`,
        },
        outputTokenChainId
      )

      // Now get the final tribunal quote using the net amount
      const netAmount = BigInt(initialQuoteAmount) - BigInt(initialDispensation)
      const dispensation = await tribunalServiceAny.getQuote(
        arbiterMapping[`${inputTokenChainId}-${outputTokenChainId}`]?.address ||
          '0x0000000000000000000000000000000000000000',
        context?.recipient ||
          sponsor ||
          '0x0000000000000000000000000000000000000000',
        process.env.NODE_ENV === 'test' ? '0' : 0n,
        process.env.NODE_ENV === 'test'
          ? expiresValue.toString()
          : BigInt(expiresValue),
        process.env.NODE_ENV === 'test'
          ? (lockParameters?.allocatorId || '0').toString()
          : BigInt(lockParameters?.allocatorId || '0'),
        process.env.NODE_ENV === 'test'
          ? netAmount.toString()
          : BigInt(netAmount),
        inputTokenChainId,
        context?.recipient ||
          sponsor ||
          '0x0000000000000000000000000000000000000000',
        process.env.NODE_ENV === 'test'
          ? netAmount.toString()
          : BigInt(netAmount),
        {
          recipient:
            context?.recipient ||
            sponsor ||
            '0x0000000000000000000000000000000000000000',
          expires:
            process.env.NODE_ENV === 'test'
              ? expiresValue.toString()
              : BigInt(expiresValue),
          token: outputTokenAddress as `0x${string}`,
          minimumAmount:
            process.env.NODE_ENV === 'test'
              ? (
                  (netAmount * BigInt(10000 - (context?.slippageBips || 100))) /
                  10000n
                ).toString()
              : (netAmount * BigInt(10000 - (context?.slippageBips || 100))) /
                10000n,
          baselinePriorityFee:
            process.env.NODE_ENV === 'test'
              ? context?.baselinePriorityFee || '0'
              : BigInt(context?.baselinePriorityFee || '0'),
          scalingFactor:
            process.env.NODE_ENV === 'test'
              ? context?.scalingFactor || '1000000000100000000'
              : BigInt(context?.scalingFactor || '1000000000100000000'),
          salt: `0x${crypto.randomBytes(32).toString('hex')}`,
        },
        outputTokenChainId
      )

      tribunalQuote = dispensation.toString()
      this.logger.info(
        `Cross-chain message cost (dispensation): ${tribunalQuote}`
      )

      // Get ETH price to convert dispensation to USD
      const ethToken: Token = {
        address: '0x0000000000000000000000000000000000000000',
        chainId: 1, // Ethereum mainnet
        decimals: 18,
        symbol: 'ETH',
      }
      const ethPrice = await this.coinGeckoProvider.getUsdPrice(ethToken)

      if (ethPrice) {
        this.logger.info(`ETH price from CoinGecko: ${ethPrice.price}`)
        this.logger.info(`Dispensation in wei: ${tribunalQuote}`)

        // ethPrice.price is already in wei (18 decimals)
        // Calculate USD value: (wei * price in wei) / 10^18
        const dispensationUsd =
          (BigInt(tribunalQuote) * BigInt(ethPrice.price)) / BigInt(10n ** 18n)
        tribunalQuoteUsd = dispensationUsd.toString()

        this.logger.info(
          `Cross-chain message cost in USD (raw): ${dispensationUsd}`
        )
        this.logger.info(
          `Cross-chain message cost in USD (formatted): ${Number(dispensationUsd) / 1e18}`
        )
      }

      // Store the tribunal quote values before attempting final quote
      const finalTribunalQuote = tribunalQuote
      const finalTribunalQuoteUsd = tribunalQuoteUsd

      // Now get final quote with dispensation if we have one
      try {
        const quote = await this.uniswapProvider.getUniswapPrice(
          inputToken,
          outputToken,
          inputTokenAmount,
          tribunalQuote || undefined
        )

        quoteOutputAmountDirect = quote.outputAmountDirect || quote.price
        quoteOutputAmountNet = quote.outputAmountNet || quote.price

        // Calculate delta if we have both spot and quote prices
        if (spotOutputAmount !== null && quoteOutputAmountNet !== null) {
          const delta = BigInt(quoteOutputAmountNet) - BigInt(spotOutputAmount)
          deltaAmount = delta.toString()
        }

        this.logger.info(
          `Uniswap quote amount (direct): ${quoteOutputAmountDirect}`
        )
        this.logger.info(`Uniswap quote amount (net): ${quoteOutputAmountNet}`)
        this.logger.info(`Calculated delta: ${deltaAmount}`)
      } catch (error) {
        // If getting the final quote fails and we have a tribunal quote,
        // we still want to return the tribunal quote
        this.logger.error(
          `Error getting final quote with dispensation: ${error}`
        )
        if (tribunalQuote) {
          quoteOutputAmountDirect = null
          quoteOutputAmountNet = null
          deltaAmount = null
          tribunalQuote = finalTribunalQuote
          tribunalQuoteUsd = finalTribunalQuoteUsd
        }
      }
    } catch (error) {
      this.logger.error(`Error getting quote with dispensation: ${error}`)
    }

    return {
      sponsor,
      inputTokenChainId,
      inputTokenAddress,
      inputTokenAmount: inputTokenAmount.toString(),
      outputTokenChainId,
      outputTokenAddress,
      spotOutputAmount,
      quoteOutputAmountDirect,
      quoteOutputAmountNet,
      deltaAmount,
      tribunalQuote,
      tribunalQuoteUsd,
      ...(lockParameters && { lockParameters }),
      ...(context && { context }),
    }
  }
}

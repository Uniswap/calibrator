import { Token, PriceData } from './interfaces/IPriceProvider.js'

/**
 * Configuration for the price service
 */
export interface PriceServiceConfig {
  /** Maximum allowed price deviation between sources (e.g., 0.01 for 1%) */
  maxPriceDeviation: number
  /** Cache duration in milliseconds */
  cacheDurationMs: number
  /** Minimum number of sources required for price validation */
  minSourcesRequired: number
}

/**
 * Extended price data with validation information
 */
export interface ValidatedPriceData extends PriceData {
  /** Number of sources that validated this price */
  sourceCount: number
  /** Maximum deviation found between sources */
  maxDeviation: number
  /** List of sources that provided this price */
  sources: string[]
}

/**
 * Price quote request parameters
 */
export interface PriceQuoteRequest {
  /** Base token (selling) */
  tokenIn: Token
  /** Quote token (buying) */
  tokenOut: Token
  /** Optional amount of tokenIn */
  amountIn?: string
  /** Optional maximum price deviation allowed */
  maxSlippage?: number
}

/**
 * Price quote response
 */
export interface PriceQuoteResponse {
  /** Validated price data */
  price: ValidatedPriceData
  /** Estimated output amount if amountIn was provided */
  estimatedOut?: string
  /** Maximum allowed slippage */
  maxSlippage: number
  /** Timestamp when quote expires */
  expiresAt: number
}

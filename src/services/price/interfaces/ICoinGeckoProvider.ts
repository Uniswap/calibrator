import { Token, PriceData } from './IPriceProvider.js'

/**
 * Configuration for CoinGecko provider
 */
export interface CoinGeckoConfig {
  /** Base URL for CoinGecko API */
  apiUrl: string
  /** Optional Pro API key */
  apiKey?: string
  /** Cache duration in milliseconds */
  cacheDurationMs: number
}

/**
 * Extended interface for CoinGecko-specific functionality
 */
export interface ICoinGeckoProvider {
  /**
   * Get token price in USD from CoinGecko
   * @param token The token to price
   * @returns Promise resolving to USD price data
   */
  getUsdPrice(token: Token): Promise<PriceData>

  /**
   * Get supported platforms (chains) from CoinGecko
   * @returns List of supported platform IDs
   */
  getSupportedPlatforms(): Promise<string[]>
}

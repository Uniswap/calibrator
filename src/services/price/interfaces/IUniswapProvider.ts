import { Token, PriceData } from './IPriceProvider.js'

/**
 * Configuration for Uniswap provider
 */
export interface UniswapConfig {
  /** Base URL for Uniswap API */
  apiUrl: string
  /** Optional API key for higher rate limits */
  apiKey?: string
  /** Cache duration in milliseconds */
  cacheDurationMs: number
}

/**
 * Extended interface for Uniswap-specific functionality
 */
export interface IUniswapProvider {
  /**
   * Get the best available price from Uniswap pools
   * @param tokenA The base token
   * @param tokenB The quote token
   * @param amount Optional amount for price impact calculation
   * @returns Promise resolving to price data with additional Uniswap details
   */
  getUniswapPrice(
    tokenA: Token,
    tokenB: Token,
    amount?: string,
    dispensationAmount?: string
  ): Promise<PriceData & {
    poolAddress?: string;
    liquidity?: string;
    outputAmountDirect?: string;
    outputAmountNet?: string;
  }>

  /**
   * Check if a direct Uniswap pool exists for the pair
   * @param tokenA The base token
   * @param tokenB The quote token
   * @returns True if a direct pool exists
   */
  hasDirectPool(tokenA: Token, tokenB: Token): Promise<boolean>
}

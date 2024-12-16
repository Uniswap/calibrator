/**
 * Represents a token with its chain and address information
 */
export interface Token {
  chainId: number
  address: string
  decimals: number
  symbol: string
}

/**
 * Price data with timestamp and source information
 */
export interface PriceData {
  price: string
  timestamp: number
  source: string
}

/**
 * Base interface for all price providers
 */
export interface IPriceProvider {
  /**
   * Get the price of tokenB denominated in tokenA
   * @param tokenA The base token
   * @param tokenB The quote token
   * @returns Promise resolving to price data
   * @throws Error if price cannot be fetched
   */
  getPrice(tokenA: Token, tokenB: Token): Promise<PriceData>

  /**
   * Check if this provider supports the given token pair
   * @param tokenA The base token
   * @param tokenB The quote token
   * @returns True if the pair is supported
   */
  supportsPair(tokenA: Token, tokenB: Token): Promise<boolean>
}

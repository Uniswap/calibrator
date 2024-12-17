/**
 * Type of quote request (exact input or output)
 */
export type QuoteType = 'EXACT_INPUT' | 'EXACT_OUTPUT'

/**
 * Request parameters for Uniswap indicative quote
 */
export interface IndicativeQuoteRequest {
  type: QuoteType
  tokenInChainId: number
  tokenOutChainId: number
  tokenIn: string
  tokenOut: string
  amount: string
}

/**
 * Response from Uniswap indicative quote
 */
export interface IndicativeQuoteResponse {
  requestId: string
  type: QuoteType
  input: {
    token: string
    chainId: number
    amount: string
  }
  output: {
    token: string
    chainId: number
    amount: string
  }
}

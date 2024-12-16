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
  quote: {
    amount: string
    amountDecimals: string
  }
  quoteGasAdjusted: {
    amount: string
    amountDecimals: string
  }
  quoteId: string
  requestId: string
  gasPriceWei: string
  gasUseEstimate: string
  routing: string
}

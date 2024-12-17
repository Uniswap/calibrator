export interface QuoteRequest {
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
}

export interface QuoteResponse {
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  quoteOutputAmount: string | null
  spotOutputAmount: string | null
  deltaAmount: string | null
}

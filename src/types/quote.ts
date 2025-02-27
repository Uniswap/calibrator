import { Address } from 'viem'

export interface LockParameters {
  allocatorId: string
  resetPeriod: number
  isMultichain: boolean
}

export interface Quote {
  sponsor: string
  inputTokenChainId: number
  outputTokenChainId: number
  inputTokenAddress: string
  outputTokenAddress: string
  inputTokenAmount: string
  outputAmountDirect: string | null
  outputAmountNet: string | null
  tribunalQuote: string | null
  tribunalQuoteUsd: string | null
}

export interface CompactData {
  arbiter: `0x${string}`
  tribunal: `0x${string}`
  sponsor: `0x${string}`
  nonce: null
  expires: bigint
  id: bigint
  amount: bigint
  maximumAmount: bigint
  [key: string]:
    | bigint
    | `0x${string}`
    | Record<string, string | number | bigint>
    | null
}

export interface QuoteContext {
  slippageBips?: number
  recipient?: string
  baselinePriorityFee?: string
  scalingFactor?: string
  fillExpires?: string
  claimExpires?: string
  [key: string]: unknown
}

export interface ArbiterConfig {
  address: Address
  tribunal: Address
  witnessTypeString: string
  resolver: (
    quote: Quote,
    sponsor: Address,
    duration: number,
    lockParameters: LockParameters,
    context: QuoteContext
  ) => Record<string, bigint | number | string | Address>
}

export interface ArbiterMapping {
  [key: string]: ArbiterConfig
}

export interface QuoteRequest {
  sponsor: string
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  lockParameters?: LockParameters
  context?: QuoteContext
}

export interface QuoteResponse {
  sponsor: string
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  spotOutputAmount: string | null
  quoteOutputAmountDirect: string | null
  quoteOutputAmountNet: string | null
  deltaAmount: string | null
  tribunalQuote: string | null
  tribunalQuoteUsd: string | null
}

import { Address } from 'viem'

export interface LockParameters {
  allocatorId: bigint
  resetPeriod: number
  isMultichain: boolean
}

export interface Quote {
  inputTokenChainId: number
  outputTokenChainId: number
  inputTokenAddress: string
  outputTokenAddress: string
  inputTokenAmount: bigint
  outputTokenAmount: bigint
  tribunalQuote?: bigint
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
  dispensation: bigint
  [key: string]: bigint | `0x${string}` | Record<string, string | number | bigint> | null
}

export interface QuoteContext {
  slippageBips?: number
  recipient?: Address
  expires?: bigint
  baselinePriorityFee?: bigint
  scalingFactor?: bigint
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
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  lockParameters?: {
    allocatorId: string
    resetPeriod: number
    isMultichain: boolean
  }
  context?: {
    slippageBips?: number
    recipient?: string
    baselinePriorityFee?: string
    scalingFactor?: string
    expires?: string
  }
}

export interface QuoteResponse {
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  spotOutputAmount: string | null
  quoteOutputAmount: string | null
  deltaAmount: string | null
  tribunalQuote: string | null
}

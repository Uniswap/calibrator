import { Address } from 'viem'

export interface LockParameters {
  allocatorId: bigint
  resetPeriod: number
  isMultichain: boolean
}

export interface Quote {
  inputToken: Address
  inputAmount: bigint
  inputChainId: number
  outputToken: Address
  outputAmount: bigint
  outputChainId: number
}

export interface CompactData {
  arbiter: Address
  sponsor: Address
  nonce: bigint | null
  expires: bigint
  id: bigint
  amount: bigint
  [witnessKey: string]: unknown
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

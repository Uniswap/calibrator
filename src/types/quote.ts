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
  [witnessKey: string]: any
}

export interface ArbiterConfig {
  address: Address
  witnessTypeString: string
  resolver: (
    quote: Quote,
    sponsor: Address,
    duration: number,
    lockParameters: LockParameters,
    context: any
  ) => Record<string, any>
}

export interface ArbiterMapping {
  [key: string]: ArbiterConfig // key format: "${inputChainId}-${outputChainId}"
}

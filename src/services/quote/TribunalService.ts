import { createPublicClient, http, PublicClient } from 'viem'
import { mainnet, optimism, base } from 'viem/chains'

const TRIBUNAL_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'arbiter', type: 'address' },
          { name: 'sponsor', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expires', type: 'uint256' },
          { name: 'id', type: 'uint256' },
          { name: 'maximumAmount', type: 'uint256' },
          { name: 'sponsorSignature', type: 'bytes' },
          { name: 'allocatorSignature', type: 'bytes' },
        ],
        name: 'compact',
        type: 'tuple',
      },
      {
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'expires', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'minimumAmount', type: 'uint256' },
          { name: 'baselinePriorityFee', type: 'uint256' },
          { name: 'scalingFactor', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
        ],
        name: 'mandate',
        type: 'tuple',
      },
      { name: 'claimant', type: 'address' },
    ],
    name: 'quote',
    outputs: [{ name: 'dispensation', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export class TribunalService {
  private ethereumClient: PublicClient
  private optimismClient: PublicClient
  private baseClient: PublicClient

  constructor() {
    // Configure clients with specific settings for each chain
    const commonConfig = {
      pollingInterval: 4_000,
      batch: {
        multicall: true,
      },
      cacheTime: 4_000,
    }

    const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL
    const optimismRpcUrl = process.env.OPTIMISM_RPC_URL
    const baseRpcUrl = process.env.BASE_RPC_URL

    if (!ethereumRpcUrl) throw new Error('ETHEREUM_RPC_URL is required')
    if (!optimismRpcUrl) throw new Error('OPTIMISM_RPC_URL is required')
    if (!baseRpcUrl) throw new Error('BASE_RPC_URL is required')

    this.ethereumClient = createPublicClient({
      ...commonConfig,
      chain: mainnet,
      transport: http(ethereumRpcUrl),
    }) as PublicClient

    this.optimismClient = createPublicClient({
      ...commonConfig,
      chain: optimism,
      transport: http(optimismRpcUrl),
    }) as PublicClient

    this.baseClient = createPublicClient({
      ...commonConfig,
      chain: base,
      transport: http(baseRpcUrl),
    }) as PublicClient
  }

  private getClientForChain(chainId: number): PublicClient {
    switch (chainId) {
      case 1:
        return this.ethereumClient
      case 10:
        return this.optimismClient
      case 8453:
        return this.baseClient
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`)
    }
  }

  private getTribunalAddress(chainId: number): `0x${string}` {
    switch (chainId) {
      case 1:
        return '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662'
      case 10:
        return '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9'
      case 8453:
        return '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1'
      default:
        throw new Error(`No tribunal address for chain ID: ${chainId}`)
    }
  }

  async getQuote(
    arbiter: string,
    sponsor: string,
    nonce: bigint,
    expires: bigint,
    id: bigint,
    maximumAmount: bigint,
    chainId: number,
    claimant: string,
    claimAmount: bigint,
    mandate: {
      recipient: string
      expires: bigint
      token: string
      minimumAmount: bigint
      baselinePriorityFee: bigint
      scalingFactor: bigint
      salt: string
    },
    targetChainId: number
  ): Promise<bigint> {
    try {
      const client = this.getClientForChain(targetChainId)
      const tribunalAddress = this.getTribunalAddress(targetChainId)

      // Use the same dummy signature for both allocator and sponsor
      const dummySignature =
        '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

      // Call the quote function on the tribunal contract
      const { result: dispensation } = await client.simulateContract({
        address: tribunalAddress,
        abi: TRIBUNAL_ABI,
        functionName: 'quote',
        args: [
          {
            chainId: BigInt(chainId),
            arbiter: arbiter as `0x${string}`,
            sponsor: sponsor as `0x${string}`,
            nonce,
            expires,
            id,
            maximumAmount,
            sponsorSignature: dummySignature as `0x${string}`,
            allocatorSignature: dummySignature as `0x${string}`,
          },
          {
            recipient: mandate.recipient as `0x${string}`,
            expires: mandate.expires,
            token: mandate.token as `0x${string}`,
            minimumAmount: mandate.minimumAmount,
            baselinePriorityFee: mandate.baselinePriorityFee,
            scalingFactor: mandate.scalingFactor,
            salt: mandate.salt as `0x${string}`,
          },
          claimant as `0x${string}`,
        ],
      })

      return dispensation
    } catch (error) {
      console.error(`[TribunalService] Error getting tribunal quote: ${error}`)
      throw error
    }
  }
}

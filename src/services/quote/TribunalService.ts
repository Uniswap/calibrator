import { createPublicClient, http, PublicClient } from 'viem'
import { mainnet, optimism, base } from 'viem/chains'
import { QuoteConfigurationService } from './QuoteConfigurationService.js'
import { arbiterMapping } from '../../config/arbiters.js'

const TRIBUNAL_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'chainId', type: 'uint256' },
          {
            components: [
              { name: 'arbiter', type: 'address' },
              { name: 'sponsor', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expires', type: 'uint256' },
              { name: 'id', type: 'uint256' },
              { name: 'amount', type: 'uint256' },
            ],
            name: 'compact',
            type: 'tuple',
          },
          { name: 'sponsorSignature', type: 'bytes' },
          { name: 'allocatorSignature', type: 'bytes' },
        ],
        name: 'claim',
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
  {
    inputs: [
      { name: 'chainId', type: 'uint256' },
      { name: 'tribunal', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'expires', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'minimumAmount', type: 'uint256' },
      { name: 'baselinePriorityFee', type: 'uint256' },
      { name: 'scalingFactor', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
    ],
    name: 'deriveMandateHash',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const

export class TribunalService {
  private ethereumClient: PublicClient
  private optimismClient: PublicClient
  private baseClient: PublicClient
  private unichainClient: PublicClient
  private quoteConfigService: QuoteConfigurationService

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
    const unichainRpcUrl = process.env.UNICHAIN_RPC_URL

    if (!ethereumRpcUrl) throw new Error('ETHEREUM_RPC_URL is required')
    if (!optimismRpcUrl) throw new Error('OPTIMISM_RPC_URL is required')
    if (!baseRpcUrl) throw new Error('BASE_RPC_URL is required')
    if (!unichainRpcUrl) throw new Error('UNICHAIN_RPC_URL is required')

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

    this.unichainClient = createPublicClient({
      ...commonConfig,
      chain: {
        id: 130,
        name: 'Unichain',
        network: 'unichain',
        nativeCurrency: {
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        rpcUrls: {
          default: { http: [unichainRpcUrl] },
          public: { http: [unichainRpcUrl] },
        },
      },
      transport: http(unichainRpcUrl),
    }) as PublicClient

    // Initialize QuoteConfigurationService with arbiter mapping
    this.quoteConfigService = new QuoteConfigurationService(arbiterMapping)
  }

  private getClientForChain(chainId: number): PublicClient {
    switch (chainId) {
      case 1:
        return this.ethereumClient
      case 10:
        return this.optimismClient
      case 8453:
        return this.baseClient
      case 130:
        return this.unichainClient
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`)
    }
  }

  private getTribunalAddress(chainId: number): `0x${string}` {
    switch (chainId) {
      case 1:
        return '0xDfd41e6E2e08e752f464084F5C11619A3c950237'
      case 10:
        return '0x2602D9f66ec17F2dc770063F7B91821DD741F626'
      case 8453:
        return '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F'
      case 130:
        return '0x81fC1d90C5fae0f15FC91B5592177B594011C576'
      default:
        throw new Error(`No tribunal address for chain ID: ${chainId}`)
    }
  }

  async getQuote(
    chainId: number,
    arbiter: string,
    sponsor: string,
    nonce: bigint,
    expires: bigint,
    id: bigint,
    amount: bigint,
    sponsorSignature: string,
    allocatorSignature: string,
    mandate: {
      recipient: string
      expires: bigint
      token: string
      minimumAmount: bigint
      baselinePriorityFee: bigint
      scalingFactor: bigint
      salt: string
    },
    claimant: string,
    targetChainId: number
  ): Promise<bigint> {
    try {
      const client = this.getClientForChain(targetChainId)
      const tribunalAddress = this.getTribunalAddress(targetChainId)

      // Get current base fee for Base chain
      let simulateOptions = {}
      if (targetChainId === 8453) {
        const block = await client.getBlock()
        const baseFee = block.baseFeePerGas || 1000000000n
        simulateOptions = {
          gas: 10000000n,
          gasPrice: baseFee * 2n,
        }
      }

      // Call the quote function on the tribunal contract
      const { result: dispensation } = await client.simulateContract({
        address: tribunalAddress,
        abi: TRIBUNAL_ABI,
        functionName: 'quote',
        ...simulateOptions,
        args: [
          {
            chainId,
            compact: {
              arbiter: arbiter as `0x${string}`,
              sponsor: sponsor as `0x${string}`,
              nonce,
              expires,
              id,
              amount,
            },
            sponsorSignature: sponsorSignature as `0x${string}`,
            allocatorSignature: allocatorSignature as `0x${string}`,
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
      console.error(
        JSON.stringify(
          {
            functionName: 'quote',
            args: [
              {
                chainId,
                compact: {
                  arbiter: arbiter as `0x${string}`,
                  sponsor: sponsor as `0x${string}`,
                  nonce,
                  expires,
                  id,
                  amount,
                },
                sponsorSignature,
                allocatorSignature,
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
          },
          null,
          2
        )
      )
      throw error
    }
  }

  async verifyMandateHash(
    mandate: {
      recipient: string
      expires: bigint
      token: string
      minimumAmount: bigint
      baselinePriorityFee: bigint
      scalingFactor: bigint
      salt: string
    },
    chainId: number
  ): Promise<{
    onChainHash: `0x${string}`
    localHash: `0x${string}`
    match: boolean
  }> {
    try {
      const client = this.getClientForChain(chainId)
      const tribunalAddress = this.getTribunalAddress(chainId)

      console.log('Contract call inputs:', {
        recipient: mandate.recipient,
        expires: mandate.expires.toString(),
        token: mandate.token,
        minimumAmount: mandate.minimumAmount.toString(),
        baselinePriorityFee: mandate.baselinePriorityFee.toString(),
        scalingFactor: mandate.scalingFactor.toString(),
        salt: mandate.salt,
      })

      // Get on-chain hash
      const { result: onChainHash } = (await client.simulateContract({
        address: tribunalAddress,
        abi: [
          {
            inputs: [
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
            ],
            name: 'deriveMandateHash',
            outputs: [{ type: 'bytes32' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'deriveMandateHash',
        args: [
          {
            recipient: mandate.recipient,
            expires: mandate.expires,
            token: mandate.token,
            minimumAmount: mandate.minimumAmount,
            baselinePriorityFee: mandate.baselinePriorityFee,
            scalingFactor: mandate.scalingFactor,
            salt: mandate.salt,
          },
        ],
      })) as { result: `0x${string}` }

      // Calculate local hash using QuoteConfigurationService
      const localHash = this.quoteConfigService.deriveMandateHash(
        chainId,
        tribunalAddress,
        mandate
      )

      // Compare hashes
      const match = onChainHash === localHash

      // Log the hashes for debugging
      console.log('Hash comparison:', {
        onChainHash,
        localHash,
        match,
        inputs: {
          recipient: mandate.recipient,
          expires: mandate.expires.toString(),
          token: mandate.token,
          minimumAmount: mandate.minimumAmount.toString(),
          baselinePriorityFee: mandate.baselinePriorityFee.toString(),
          scalingFactor: mandate.scalingFactor.toString(),
          salt: mandate.salt,
        },
      })

      return {
        onChainHash,
        localHash,
        match,
      }
    } catch (error) {
      console.error('Error verifying mandate hash:', error)
      throw error
    }
  }
}

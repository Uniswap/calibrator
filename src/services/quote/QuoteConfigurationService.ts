import { Address, encodeAbiParameters, keccak256, concat } from 'viem'
import type {
  ArbiterMapping,
  CompactData,
  LockParameters,
  Quote,
  QuoteContext,
} from '../../types/quote.js'

export class QuoteConfigurationService {
  private arbiterMapping: ArbiterMapping

  constructor(arbiterMapping: ArbiterMapping) {
    this.arbiterMapping = arbiterMapping
  }

  public async generateConfiguration(
    quote: Quote,
    sponsor: Address,
    duration: number,
    lockParameters: LockParameters,
    context: QuoteContext
  ): Promise<{
    data: CompactData
    witnessHash: `0x${string}`
  }> {
    // Find the appropriate arbiter
    const arbiterKey = `${quote.inputChainId}-${quote.outputChainId}`
    const arbiter = this.arbiterMapping[arbiterKey]

    if (!arbiter) {
      throw new Error(`No arbiter found for chain pair ${arbiterKey}`)
    }

    // Calculate expiration time (now + duration)
    const expires = BigInt(Math.floor(Date.now() / 1000) + duration)

    // Calculate ID based on lock parameters
    const id = this.calculateId(quote.inputToken, lockParameters)

    // Generate the base compact data
    const compactData: CompactData = {
      arbiter: arbiter.address,
      sponsor,
      nonce: null,
      expires,
      id,
      amount: quote.inputAmount,
    }

    // Get witness data from resolver
    const witnessData = arbiter.resolver(
      quote,
      sponsor,
      duration,
      lockParameters,
      context
    )

    // Extract witness key from typestring (e.g., "Mandate mandate" -> "mandate")
    const witnessKey = arbiter.witnessTypeString.split(' ')[1].split(')')[0]
    compactData[witnessKey] = witnessData

    // Generate EIP-712 hash of the witness data
    const witnessHash = this.generateWitnessHash(
      arbiter.witnessTypeString,
      witnessData
    )

    return {
      data: compactData,
      witnessHash,
    }
  }

  private calculateId(
    inputToken: Address,
    { isMultichain, resetPeriod, allocatorId }: LockParameters
  ): bigint {
    const multiChainBit = isMultichain ? 0n : 1n
    const inputTokenBigInt = BigInt(inputToken)

    return (
      (multiChainBit << 255n) |
      (BigInt(resetPeriod) << 252n) |
      (allocatorId << 160n) |
      inputTokenBigInt
    )
  }

  private generateWitnessHash(
    witnessTypeString: string,
    witnessData: Record<string, bigint | number | string | Address>
  ): `0x${string}` {
    // Parse the type string to get the struct name and parameters
    const [structName, paramString] = witnessTypeString.split(' ')[0].split('(')
    const cleanParamString = paramString.slice(0, -1) // remove trailing ')'

    // Parse parameters into types array
    const params = cleanParamString.split(',').map(param => {
      const [type, name] = param.trim().split(' ')
      return { type, name }
    })

    // Generate typeHash using just the type definition
    const typeHash = keccak256(
      encodeAbiParameters(
        [{ type: 'string' }],
        [`${structName}(${cleanParamString})`]
      )
    )

    // Encode the witness data according to the parsed parameters
    const encodedData = encodeAbiParameters(
      params.map(({ type }) => ({ type })),
      params.map(({ name }) => witnessData[name])
    )

    // Concatenate and hash
    return keccak256(concat([typeHash, encodedData]))
  }
}

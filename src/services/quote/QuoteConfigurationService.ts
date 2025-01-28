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
    dispensation: bigint
  }> {
    // Validate reset period
    if (lockParameters.resetPeriod < 0 || lockParameters.resetPeriod > 7) {
      throw new Error('Reset period must be between 0 and 7')
    }

    // Get arbiter for chain pair
    const chainPair = `${quote.inputTokenChainId}-${quote.outputTokenChainId}`
    const arbiter = this.arbiterMapping[chainPair]
    if (!arbiter) {
      throw new Error(`No arbiter found for chain pair ${chainPair}`)
    }

    // Calculate ID and expiration
    const id = this.calculateId(lockParameters, quote.inputTokenAddress)
    const expires = context.expires
      ? BigInt(context.expires)
      : BigInt(Math.floor(Date.now() / 1000) + duration)

    // Get witness data from resolver
    const witness = arbiter.resolver(
      quote,
      sponsor,
      duration,
      lockParameters,
      context
    )

    // Parse witness type string to get variable name
    const parts = arbiter.witnessTypeString.split(')')
    const nonEmptyParts = parts.filter(part => part.length > 0)
    if (nonEmptyParts.length !== 2) {
      throw new Error(
        'Invalid witness type string format: missing variable declaration'
      )
    }
    const [variableDecl] = nonEmptyParts
    const [, variableName] = variableDecl.split(' ')
    if (!variableName) {
      throw new Error(
        'Invalid witness type string format: invalid variable declaration'
      )
    }

    // Generate witness hash
    const witnessHash = await this.generateWitnessHash(
      arbiter.witnessTypeString,
      witness
    )

    // Return configuration with dynamic witness key
    return {
      data: {
        arbiter: arbiter.address,
        tribunal: arbiter.tribunal,
        sponsor,
        nonce: null,
        expires,
        id,
        amount: BigInt(quote.inputTokenAmount),
        maximumAmount: BigInt(quote.outputAmountNet),
        dispensation: quote.tribunalQuote ? BigInt(quote.tribunalQuote) : 0n,
        [variableName]: witness,
      },
      witnessHash,
      dispensation: quote.tribunalQuote ? BigInt(quote.tribunalQuote) : 0n,
    }
  }

  private calculateId(
    lockParameters: LockParameters,
    inputToken: string
  ): bigint {
    const multiChainBit = lockParameters.isMultichain ? 0n : 1n
    const inputTokenBigInt = BigInt(inputToken)
    const allocatorIdBigInt = BigInt(lockParameters.allocatorId)

    return (
      (multiChainBit << 255n) |
      (BigInt(lockParameters.resetPeriod) << 252n) |
      (allocatorIdBigInt << 160n) |
      (inputTokenBigInt & ((1n << 160n) - 1n))
    )
  }

  private calculateMinimumAmount(amount: bigint, slippageBips: number): bigint {
    return amount - (amount * BigInt(slippageBips)) / 10000n
  }

  private generateWitnessHash(
    witnessTypeString: string,
    witnessData: Record<string, bigint | number | string | Address>
  ): `0x${string}` {
    // Parse the type string to get the struct name and parameters
    // Format: "StructType variableName)StructType(param1 name1,param2 name2,...)"
    const parts = witnessTypeString.split(')')

    // Filter out empty strings and check length
    const nonEmptyParts = parts.filter(part => part.length > 0)
    if (nonEmptyParts.length !== 2) {
      throw new Error(
        'Invalid witness type string format: missing variable declaration'
      )
    }

    const [variableDecl, typeDefinition] = nonEmptyParts
    const [structName, variableName] = variableDecl.split(' ')

    if (!structName || !variableName) {
      throw new Error(
        'Invalid witness type string format: invalid variable declaration'
      )
    }

    // Extract parameter string from the type definition
    const matches = typeDefinition.match(/^(\w+)\((.*?)(?:\)|$)/)

    if (!matches || matches[1] !== structName) {
      throw new Error(
        'Invalid witness type string format: struct name mismatch or invalid parameter list'
      )
    }
    const paramString = matches[2]

    // Parse parameters into types array
    const params = paramString.split(',').map(param => {
      const [type, name] = param.trim().split(' ')
      if (!type || !name) {
        throw new Error(
          'Invalid witness type string format: invalid parameter declaration'
        )
      }
      return { type, name }
    })

    // Generate typeHash using just the type definition
    const typeHash = keccak256(
      encodeAbiParameters(
        [{ type: 'string' }],
        [`${structName}(${params.map(p => p.type).join(',')})`]
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

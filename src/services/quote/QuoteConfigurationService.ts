import { Address, encodeAbiParameters, keccak256, toBytes } from 'viem'
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
    // Calculate expiry timestamps
    const now = BigInt(Math.floor(Date.now() / 1000))
    const fillExpires = context.fillExpires
      ? BigInt(context.fillExpires)
      : now + BigInt(duration)
    const claimExpires = context.claimExpires
      ? BigInt(context.claimExpires)
      : fillExpires + BigInt(300) // 5 minutes of buffer

    // Ensure fillExpires comes before claimExpires
    if (fillExpires >= claimExpires) {
      throw new Error('fillExpires must be before claimExpires')
    }

    // Get witness data from resolver with complete context
    const completeContext = {
      ...context,
      fillExpires: fillExpires.toString(),
      claimExpires: claimExpires.toString(),
    }
    const witness = arbiter.resolver(
      quote,
      sponsor,
      duration,
      lockParameters,
      completeContext
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
        expires: claimExpires,
        id,
        amount: BigInt(quote.inputTokenAmount),
        maximumAmount:
          quote.outputAmountNet === null ? 0n : BigInt(quote.outputAmountNet),
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

    const [variableDecl, typeDefinitionWithoutClosing] = nonEmptyParts
    const [structName, variableName] = variableDecl.split(' ')

    if (!structName || !variableName) {
      throw new Error(
        'Invalid witness type string format: invalid variable declaration'
      )
    }

    // Extract parameter string from the type definition
    const matches = typeDefinitionWithoutClosing.match(/^(\w+)\((.*?)(?:\)|$)/)

    if (!matches || matches[1] !== structName) {
      throw new Error(
        'Invalid witness type string format: struct name mismatch or invalid parameter list'
      )
    }

    // Parse parameters into types array for encoding
    const params = typeDefinitionWithoutClosing
      .split('(')[1]
      .split(')')[0]
      .split(',')
      .map(param => {
        const [type, name] = param.trim().split(' ')
        if (!type || !name) {
          throw new Error(
            'Invalid witness type string format: invalid parameter declaration'
          )
        }
        return { type, name }
      })

    const typeDefinition = typeDefinitionWithoutClosing + ')'

    // Generate typeHash using just the type definition
    const typeHash = keccak256(toBytes(typeDefinition))

    // Create arrays for encoding
    const types = [{ type: 'bytes32' }, ...params.map(({ type }) => ({ type }))]
    const values = [
      typeHash,
      ...params.map(({ name }) => {
        const value = witnessData[name]
        if (value === undefined) {
          throw new Error(`Missing value for parameter: ${name}`)
        }
        return value
      }),
    ]

    // Encode the witness data
    const encodedData = encodeAbiParameters(types, values)

    // Debug logging
    console.log('generateWitnessHash encoded:', {
      encodedData,
      finalHash: keccak256(encodedData),
    })

    // Return the final hash
    return keccak256(encodedData)
  }

  public deriveMandateHash(
    chainId: number,
    tribunal: string,
    mandate: {
      recipient: string
      expires: bigint
      token: string
      minimumAmount: bigint
      baselinePriorityFee: bigint
      scalingFactor: bigint
      salt: string
    }
  ): `0x${string}` {
    // Calculate MANDATE_TYPEHASH to match Solidity's EIP-712 typed data
    const MANDATE_TYPE_STRING =
      'Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)'
    const MANDATE_TYPEHASH = keccak256(toBytes(MANDATE_TYPE_STRING))

    // Log the inputs for debugging
    console.log('Local hash calculation:', {
      MANDATE_TYPE_STRING,
      MANDATE_TYPEHASH,
      inputs: {
        chainId: BigInt(chainId),
        tribunal: tribunal.toLowerCase(),
        recipient: mandate.recipient.toLowerCase(),
        expires: mandate.expires.toString(),
        token: mandate.token.toLowerCase(),
        minimumAmount: mandate.minimumAmount.toString(),
        baselinePriorityFee: mandate.baselinePriorityFee.toString(),
        scalingFactor: mandate.scalingFactor.toString(),
        salt: mandate.salt,
      },
    })

    // Now encode all the parameters with the typehash, matching the contract's abi.encode
    const encodedData = encodeAbiParameters(
      [
        { type: 'bytes32' }, // MANDATE_TYPEHASH
        { type: 'uint256' }, // block.chainid
        { type: 'address' }, // address(this)
        { type: 'address' }, // mandate.recipient
        { type: 'uint256' }, // mandate.expires
        { type: 'address' }, // mandate.token
        { type: 'uint256' }, // mandate.minimumAmount
        { type: 'uint256' }, // mandate.baselinePriorityFee
        { type: 'uint256' }, // mandate.scalingFactor
        { type: 'bytes32' }, // mandate.salt
      ],
      [
        MANDATE_TYPEHASH,
        BigInt(chainId),
        tribunal.toLowerCase() as `0x${string}`,
        mandate.recipient.toLowerCase() as `0x${string}`,
        mandate.expires,
        mandate.token.toLowerCase() as `0x${string}`,
        mandate.minimumAmount,
        mandate.baselinePriorityFee,
        mandate.scalingFactor,
        mandate.salt as `0x${string}`,
      ]
    )

    // Return the final hash
    return keccak256(encodedData)
  }
}

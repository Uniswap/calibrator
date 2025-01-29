import {
  type ArbiterMapping,
  type Quote,
  type QuoteContext,
} from '../types/quote.js'

const resolverTemplate = (
  quote: Quote,
  sponsor: `0x${string}`,
  duration: number,
  context: QuoteContext,
  tribunal: string
) => ({
  chainId: quote.outputTokenChainId,
  tribunal,
  recipient: context.recipient || sponsor,
  expires: context.expires
    ? BigInt(context.expires)
    : BigInt(Math.floor(Date.now() / 1000) + duration),
  token: quote.outputTokenAddress,
  minimumAmount:
    quote.outputAmountNet === null
      ? 0n
      : (BigInt(quote.outputAmountNet) *
          BigInt(10000 - (context.slippageBips || 100))) /
        10000n,
  baselinePriorityFee: context.baselinePriorityFee
    ? BigInt(context.baselinePriorityFee)
    : 0n,
  scalingFactor: context.scalingFactor
    ? BigInt(context.scalingFactor)
    : 1000000000100000000n,
  salt: '0x3333333333333333333333333333333333333333333333333333333333333333',
})

export const arbiterMapping: ArbiterMapping = {
  // Optimism -> Base
  '10-8453': {
    address: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
    tribunal: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1'
      ),
  },
  // Base -> Optimism
  '8453-10': {
    address: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
    tribunal: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9'
      ),
  },
  // Ethereum -> Optimism
  '1-10': {
    address: '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662',
    tribunal: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9'
      ),
  },
  // Optimism -> Ethereum
  '10-1': {
    address: '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9',
    tribunal: '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662'
      ),
  },
  // Base -> Ethereum
  '8453-1': {
    address: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
    tribunal: '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662'
      ),
  },
  // Ethereum -> Base
  '1-8453': {
    address: '0x6d72dB874D4588931Ffe2Fc0b75c687328a86662',
    tribunal: '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1'
      ),
  },
}

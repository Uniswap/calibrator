import {
  type ArbiterMapping,
  type Quote,
  type QuoteContext,
} from '../types/quote.js'
import crypto from 'crypto'

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
  expires: BigInt(context.fillExpires!),
  token: quote.outputTokenAddress,
  minimumAmount:
    quote.outputAmountNet === null
      ? 0n
      : BigInt(quote.outputAmountNet) -
        (BigInt(quote.outputAmountNet) * BigInt(context.slippageBips || 100)) /
          10000n,
  baselinePriorityFee: context.baselinePriorityFee
    ? BigInt(context.baselinePriorityFee)
    : 0n,
  scalingFactor: context.scalingFactor
    ? BigInt(context.scalingFactor)
    : 1000000000100000000n,
  salt: `0x${crypto.randomBytes(32).toString('hex')}`,
})

export const arbiterMapping: ArbiterMapping = {
  // Optimism -> Base
  '10-8453': {
    address: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    tribunal: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F'
      ),
  },
  // Base -> Optimism
  '8453-10': {
    address: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    tribunal: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x2602D9f66ec17F2dc770063F7B91821DD741F626'
      ),
  },
  // Ethereum -> Optimism
  '1-10': {
    address: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    tribunal: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x2602D9f66ec17F2dc770063F7B91821DD741F626'
      ),
  },
  // Optimism -> Ethereum
  '10-1': {
    address: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    tribunal: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xDfd41e6E2e08e752f464084F5C11619A3c950237'
      ),
  },
  // Base -> Ethereum
  '8453-1': {
    address: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    tribunal: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xDfd41e6E2e08e752f464084F5C11619A3c950237'
      ),
  },
  // Ethereum -> Base
  '1-8453': {
    address: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    tribunal: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F'
      ),
  },
  // Unichain -> Ethereum
  '130-1': {
    address: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    tribunal: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xDfd41e6E2e08e752f464084F5C11619A3c950237'
      ),
  },
  // Ethereum -> Unichain
  '1-130': {
    address: '0xDfd41e6E2e08e752f464084F5C11619A3c950237',
    tribunal: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x81fC1d90C5fae0f15FC91B5592177B594011C576'
      ),
  },
  // Unichain -> Base
  '130-8453': {
    address: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    tribunal: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F'
      ),
  },
  // Base -> Unichain
  '8453-130': {
    address: '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F',
    tribunal: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x81fC1d90C5fae0f15FC91B5592177B594011C576'
      ),
  },
  // Unichain -> Optimism
  '130-10': {
    address: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    tribunal: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x2602D9f66ec17F2dc770063F7B91821DD741F626'
      ),
  },
  // Optimism -> Unichain
  '10-130': {
    address: '0x2602D9f66ec17F2dc770063F7B91821DD741F626',
    tribunal: '0x81fC1d90C5fae0f15FC91B5592177B594011C576',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x81fC1d90C5fae0f15FC91B5592177B594011C576'
      ),
  },
}

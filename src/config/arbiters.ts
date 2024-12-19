import {
  type ArbiterMapping,
  type Quote,
  type LockParameters,
  type QuoteContext,
} from '../types/quote.js'

export const arbiterMapping: ArbiterMapping = {
  // Optimism -> Base
  '10-8453': {
    address: '0x1111111111111111111111111111111111111111',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (
      quote: Quote,
      sponsor: `0x${string}`,
      duration: number,
      lockParameters: LockParameters,
      context: QuoteContext
    ) => ({
      chainId: quote.outputChainId,
      tribunal: '0x2222222222222222222222222222222222222222',
      recipient: context.recipient || sponsor,
      expires:
        context.expires || BigInt(Math.floor(Date.now() / 1000) + duration),
      token: quote.outputToken,
      minimumAmount:
        (quote.outputAmount * BigInt(10000 - (context.slippageBips || 100))) /
        10000n,
      baselinePriorityFee: context.baselinePriorityFee || 0n,
      scalingFactor: context.scalingFactor || 1000000000100000000n,
      salt: '0x3333333333333333333333333333333333333333333333333333333333333333',
    }),
  },
}

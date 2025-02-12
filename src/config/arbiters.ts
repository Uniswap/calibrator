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
    address: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    tribunal: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A'
      ),
  },
  // Base -> Optimism
  '8453-10': {
    address: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    tribunal: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xb7dD9E63A0d594C6e58c84bB85660819B7941770'
      ),
  },
  // Ethereum -> Optimism
  '1-10': {
    address: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    tribunal: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xb7dD9E63A0d594C6e58c84bB85660819B7941770'
      ),
  },
  // Optimism -> Ethereum
  '10-1': {
    address: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    tribunal: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456'
      ),
  },
  // Base -> Ethereum
  '8453-1': {
    address: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    tribunal: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456'
      ),
  },
  // Ethereum -> Base
  '1-8453': {
    address: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    tribunal: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A'
      ),
  },
  // Unichain -> Ethereum
  '130-1': {
    address: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    tribunal: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456'
      ),
  },
  // Ethereum -> Unichain
  '1-130': {
    address: '0xB74e28F61EE4CF7C1Fd5eCB68ee3A5a60f0Ce456',
    tribunal: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x7f268357A8c2552623316e2562D90e642bB538E5'
      ),
  },
  // Unichain -> Base
  '130-8453': {
    address: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    tribunal: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A'
      ),
  },
  // Base -> Unichain
  '8453-130': {
    address: '0xC0AdfB14A08c5A3f0d6c21cFa601b43bA93B3c8A',
    tribunal: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x7f268357A8c2552623316e2562D90e642bB538E5'
      ),
  },
  // Unichain -> Optimism
  '130-10': {
    address: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    tribunal: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0xb7dD9E63A0d594C6e58c84bB85660819B7941770'
      ),
  },
  // Optimism -> Unichain
  '10-130': {
    address: '0xb7dD9E63A0d594C6e58c84bB85660819B7941770',
    tribunal: '0x7f268357A8c2552623316e2562D90e642bB538E5',
    witnessTypeString:
      'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
    resolver: (quote, sponsor, duration, _lockParameters, context) =>
      resolverTemplate(
        quote,
        sponsor,
        duration,
        context,
        '0x7f268357A8c2552623316e2562D90e642bB538E5'
      ),
  },
}

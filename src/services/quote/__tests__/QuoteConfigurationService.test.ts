import { QuoteConfigurationService } from '../QuoteConfigurationService'
import { arbiterMapping } from '../../../config/arbiters'
import {
  type Quote,
  type LockParameters,
  type QuoteContext,
} from '../../../types/quote'

interface MandateData {
  chainId: number
  tribunal: string
  recipient: string
  expires: string
  token: string
  minimumAmount: string
  baselinePriorityFee: string
  scalingFactor: string
  salt: string
}

describe('QuoteConfigurationService', () => {
  const service = new QuoteConfigurationService(arbiterMapping)
  const mockQuote: Quote = {
    inputTokenAddress: '0x4444444444444444444444444444444444444444',
    inputTokenAmount: '1000000000000000000',
    inputTokenChainId: 10,
    outputTokenAddress: '0x5555555555555555555555555555555555555555',
    outputAmountDirect: '1000000000000000000',
    outputAmountNet: '900000000000000000',
    outputTokenChainId: 8453,
    tribunalQuote: null,
    tribunalQuoteUsd: null,
  }
  const mockSponsor = '0x6666666666666666666666666666666666666666'
  const mockDuration = 3600
  const mockLockParameters: LockParameters = {
    allocatorId: '123',
    resetPeriod: 4,
    isMultichain: true,
  }
  const mockContext: Required<QuoteContext> = {
    slippageBips: 50,
    recipient: '0x7777777777777777777777777777777777777777',
    expires: '1703023200', // 2023-12-20T00:00:00Z
    baselinePriorityFee: '2000000000',
    scalingFactor: '1000000000200000000',
  }

  describe('generateConfiguration', () => {
    it('should generate correct configuration for Optimism -> Base', async () => {
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      // Verify the compact data
      expect(result.data.arbiter).toBe(
        '0xf4eA570740Ce552632F19c8E92691c6A5F6374D9'
      )
      expect(result.data.sponsor).toBe(mockSponsor)
      expect(result.data.nonce).toBeNull()
      expect(result.data.expires.toString()).toBe(
        mockContext.expires.toString()
      )
      expect(result.data.amount.toString()).toBe(
        mockQuote.inputTokenAmount.toString()
      )

      // Verify the mandate data
      const mandate = result.data.mandate as unknown as MandateData
      expect(mandate.chainId).toBe(mockQuote.outputTokenChainId)
      expect(mandate.tribunal).toBe(
        '0x339B234fdBa8C5C77c43AA01a6ad38071B7984F1'
      )
      expect(mandate.recipient).toBe(mockContext.recipient)
      expect(mandate.expires.toString()).toBe(mockContext.expires.toString())
      expect(mandate.token).toBe(mockQuote.outputTokenAddress)
      expect(mandate.minimumAmount.toString()).toBe('895500000000000000') // 99.5% of output amount (50 bips slippage)
      expect(mandate.baselinePriorityFee.toString()).toBe(
        mockContext.baselinePriorityFee.toString()
      )
      expect(mandate.scalingFactor.toString()).toBe(
        mockContext.scalingFactor.toString()
      )
      expect(mandate.salt).toBe(
        '0x3333333333333333333333333333333333333333333333333333333333333333'
      )

      // Verify witness hash is generated
      expect(result.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should use default values when context is empty', async () => {
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        {}
      )

      const mandate = result.data.mandate as unknown as MandateData
      expect(mandate.recipient).toBe(mockSponsor)
      expect(mandate.minimumAmount.toString()).toBe('891000000000000000') // 99% of output amount (default 100 bips slippage)
      expect(mandate.baselinePriorityFee.toString()).toBe('0')
      expect(mandate.scalingFactor.toString()).toBe('1000000000100000000')
    })

    it('should throw error for unsupported chain pair', async () => {
      const invalidQuote = { ...mockQuote, outputTokenChainId: 42161 } // Use Arbitrum chain ID which we don't have an arbiter for
      await expect(
        service.generateConfiguration(
          invalidQuote,
          mockSponsor,
          mockDuration,
          mockLockParameters,
          mockContext
        )
      ).rejects.toThrow('No arbiter found for chain pair 10-42161')
    })

    it('should throw error for invalid reset period', async () => {
      const invalidLockParameters = { ...mockLockParameters, resetPeriod: 8 }
      await expect(
        service.generateConfiguration(
          mockQuote,
          mockSponsor,
          mockDuration,
          invalidLockParameters,
          mockContext
        )
      ).rejects.toThrow('Reset period must be between 0 and 7')

      const negativeLockParameters = { ...mockLockParameters, resetPeriod: -1 }
      await expect(
        service.generateConfiguration(
          mockQuote,
          mockSponsor,
          mockDuration,
          negativeLockParameters,
          mockContext
        )
      ).rejects.toThrow('Reset period must be between 0 and 7')
    })
  })

  describe('calculateId', () => {
    it('should calculate correct ID for multichain lock', async () => {
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      // Verify ID calculation:
      // multiChainBit (0) << 255 |
      // resetPeriod (24) << 252 |
      // allocatorId (123) << 160 |
      // inputToken
      const expectedId =
        (0n << 255n) |
        (4n << 252n) |
        (123n << 160n) |
        BigInt(mockQuote.inputTokenAddress)

      expect(result.data.id.toString()).toBe(expectedId.toString())
    })

    it('should calculate correct ID for single-chain lock', async () => {
      const singleChainLock = { ...mockLockParameters, isMultichain: false }
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        singleChainLock,
        mockContext
      )

      const expectedId =
        (1n << 255n) |
        (4n << 252n) |
        (123n << 160n) |
        BigInt(mockQuote.inputTokenAddress)

      expect(result.data.id.toString()).toBe(expectedId.toString())
    })
  })

  describe('generateWitnessHash', () => {
    it('should correctly parse witness type string and generate hash', async () => {
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      // Verify the hash matches expected format
      expect(result.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)

      // Generate a second hash with same data - should match
      const secondResult = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )
      expect(result.witnessHash).toBe(secondResult.witnessHash)
    })

    it('should handle complex witness type strings', async () => {
      // Create a test service with a complex witness type
      const complexArbiterMapping = {
        '10-8453': {
          ...arbiterMapping['10-8453'],
          witnessTypeString:
            'ComplexMandate complexMandate)ComplexMandate(uint256 value1,address addr1,bytes32 hash1,string text1)',
          resolver: () => ({
            value1: 123n,
            addr1: '0x1111111111111111111111111111111111111111',
            hash1:
              '0x2222222222222222222222222222222222222222222222222222222222222222',
            text1: 'test',
          }),
        },
      }
      const complexService = new QuoteConfigurationService(
        complexArbiterMapping
      )

      const result = await complexService.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      // Verify the hash matches expected format
      expect(result.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should generate different hashes for different witness data', async () => {
      // Create two test services with different witness data
      const testArbiterMapping1 = {
        '10-8453': {
          ...arbiterMapping['10-8453'],
          resolver: () => ({
            chainId: 1,
            tribunal: '0x1111111111111111111111111111111111111111',
            recipient: '0x2222222222222222222222222222222222222222',
            expires: 1703023200n,
            token: '0x3333333333333333333333333333333333333333',
            minimumAmount: 100n,
            baselinePriorityFee: 1n,
            scalingFactor: 1n,
            salt: '0x4444444444444444444444444444444444444444444444444444444444444444',
          }),
        },
      }

      const testArbiterMapping2 = {
        '10-8453': {
          ...arbiterMapping['10-8453'],
          resolver: () => ({
            chainId: 2,
            tribunal: '0x5555555555555555555555555555555555555555',
            recipient: '0x6666666666666666666666666666666666666666',
            expires: 1703023200n,
            token: '0x7777777777777777777777777777777777777777',
            minimumAmount: 200n,
            baselinePriorityFee: 2n,
            scalingFactor: 2n,
            salt: '0x8888888888888888888888888888888888888888888888888888888888888888',
          }),
        },
      }

      const service1 = new QuoteConfigurationService(testArbiterMapping1)
      const service2 = new QuoteConfigurationService(testArbiterMapping2)

      const result1 = await service1.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      const result2 = await service2.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )

      expect(result1.witnessHash).not.toBe(result2.witnessHash)
    })
  })
})

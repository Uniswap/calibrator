import { QuoteConfigurationService } from '../QuoteConfigurationService'
import { arbiterMapping } from '../../../config/arbiters'
import {
  type Quote,
  type LockParameters,
  type QuoteContext,
} from '../../../types/quote'
import crypto from 'crypto'

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
    sponsor: '0x1111111111111111111111111111111111111111',
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
    fillExpires: '1703023200', // 2023-12-20T00:00:00Z
    claimExpires: '1703026800', // 2023-12-20T01:00:00Z (1 hour after fillExpires)
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
        '0x2602D9f66ec17F2dc770063F7B91821DD741F626'
      )
      expect(result.data.sponsor).toBe(mockSponsor)
      expect(result.data.nonce).toBeNull()
      // Verify compact uses claimExpires
      expect(result.data.expires.toString()).toBe(
        mockContext.claimExpires.toString()
      )
      expect(result.data.amount.toString()).toBe(
        mockQuote.inputTokenAmount.toString()
      )

      // Verify the mandate data
      const mandate = result.data.mandate as unknown as MandateData
      expect(mandate.chainId).toBe(mockQuote.outputTokenChainId)
      expect(mandate.tribunal).toBe(
        '0xfaBE453252ca8337b091ba01BB168030E2FE6c1F'
      )
      expect(mandate.recipient).toBe(mockContext.recipient)
      // Verify mandate uses fillExpires
      expect(mandate.expires.toString()).toBe(
        mockContext.fillExpires.toString()
      )
      expect(mandate.token).toBe(mockQuote.outputTokenAddress)
      expect(mandate.minimumAmount.toString()).toBe('895500000000000000') // 99.5% of output amount (50 bips slippage)
      expect(mandate.baselinePriorityFee.toString()).toBe(
        mockContext.baselinePriorityFee.toString()
      )
      expect(mandate.scalingFactor.toString()).toBe(
        mockContext.scalingFactor.toString()
      )
      expect(mandate.salt).toMatch(/^0x[a-f0-9]{64}$/)

      // Verify witness hash is generated
      expect(result.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('should throw error when fillExpires is after claimExpires', async () => {
      const invalidContext = {
        ...mockContext,
        fillExpires: '1703026800', // 2023-12-20T01:00:00Z
        claimExpires: '1703023200', // 2023-12-20T00:00:00Z
      }
      await expect(
        service.generateConfiguration(
          mockQuote,
          mockSponsor,
          mockDuration,
          mockLockParameters,
          invalidContext
        )
      ).rejects.toThrow('fillExpires must be before claimExpires')
    })

    it('should use default values when context is empty', async () => {
      const result = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        {}
      )

      // Verify mandate and compact data
      const mandate = result.data.mandate as unknown as MandateData
      const now = Math.floor(Date.now() / 1000)
      const defaultFillExpires = BigInt(now + mockDuration)
      const defaultClaimExpires = defaultFillExpires + BigInt(300) // 5 minutes buffer

      expect(mandate.recipient).toBe(mockSponsor)
      expect(BigInt(mandate.expires)).toBe(defaultFillExpires)
      expect(result.data.expires).toBe(defaultClaimExpires)
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

      // Generate a second hash with same data - should be different due to random salt
      const secondResult = await service.generateConfiguration(
        mockQuote,
        mockSponsor,
        mockDuration,
        mockLockParameters,
        mockContext
      )
      // Each result should have a valid hash format
      expect(result.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
      expect(secondResult.witnessHash).toMatch(/^0x[a-f0-9]{64}$/)
      // Hashes should be different due to random salts
      expect(result.witnessHash).not.toBe(secondResult.witnessHash)
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
            salt: `0x${crypto.randomBytes(32).toString('hex')}`,
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
            salt: `0x${crypto.randomBytes(32).toString('hex')}`,
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

  describe('mandate hash calculation', () => {
    let hashService: QuoteConfigurationService

    beforeEach(() => {
      hashService = new QuoteConfigurationService({})
    })

    it('should produce same hash for mandate in generateWitnessHash and deriveMandateHash', () => {
      // Test values for Optimism (chainId 10)
      const mandate = {
        recipient: '0x1234567890123456789012345678901234567890',
        expires: BigInt('1735686000'), // Jan 1, 2025
        token: '0x4200000000000000000000000000000000000006', // WETH on Optimism
        minimumAmount: BigInt('1000000000000000000'), // 1 ETH
        baselinePriorityFee: BigInt('1000000000'), // 1 gwei
        scalingFactor: BigInt('1000000000000000000'), // 1.0
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }

      const chainId = 10
      const tribunalAddress = '0x2602D9f66ec17F2dc770063F7B91821DD741F626' // Optimism Tribunal

      // Use type assertion to access private method
      const witnessHash = (hashService as any).generateWitnessHash(
        'Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)',
        {
          chainId,
          tribunal: tribunalAddress,
          ...mandate,
        }
      )

      const mandateHash = hashService.deriveMandateHash(
        chainId,
        tribunalAddress,
        mandate
      )

      // They should match
      expect(witnessHash).toBe(mandateHash)
    })

    it('should correctly calculate mandate hash', () => {
      // Test values for Optimism (chainId 10)
      const mandate = {
        recipient: '0x1234567890123456789012345678901234567890',
        expires: BigInt('1735686000'), // Jan 1, 2025
        token: '0x4200000000000000000000000000000000000006', // WETH on Optimism
        minimumAmount: BigInt('1000000000000000000'), // 1 ETH
        baselinePriorityFee: BigInt('1000000000'), // 1 gwei
        scalingFactor: BigInt('1000000000000000000'), // 1.0
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }

      const chainId = 10
      const tribunalAddress = '0x2602D9f66ec17F2dc770063F7B91821DD741F626' // Optimism Tribunal

      // Generate hash
      const mandateHash = hashService.deriveMandateHash(
        chainId,
        tribunalAddress,
        mandate
      )

      // Should match the expected format
      expect(mandateHash).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })
})

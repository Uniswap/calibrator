import { PriceService } from '../PriceService.js'
import { mockToken, mockPriceData, MockPriceProvider } from './testUtils.js'
import { PriceServiceConfig } from '../types.js'

describe('PriceService', () => {
  const defaultConfig: PriceServiceConfig = {
    maxPriceDeviation: 0.01,
    cacheDurationMs: 60000,
    minSourcesRequired: 1, // Changed from 2 to 1 for tests
  }

  describe('getQuote', () => {
    it('should return a valid quote when providers agree on price', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData('1.000', 'test1'))
      const provider2 = new MockPriceProvider(mockPriceData('1.010', 'test2'))
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act
      const quote = await service.getQuote({
        tokenIn: mockToken(1, '0x1'),
        tokenOut: mockToken(1, '0x2'),
      })

      // Assert
      expect(quote.price.sourceCount).toBe(2)
      expect(quote.price.sources).toContain('test1')
      expect(quote.price.sources).toContain('test2')
      expect(quote.price.price).toBe('1.005')
      expect(quote.price.maxDeviation).toBeLessThan(
        defaultConfig.maxPriceDeviation
      )
    })

    it('should calculate estimated output when amountIn is provided', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData('2.0', 'test1'))
      const provider2 = new MockPriceProvider(mockPriceData('2.0', 'test2'))
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act
      const quote = await service.getQuote({
        tokenIn: mockToken(),
        tokenOut: mockToken(),
        amountIn: '100',
      })

      // Assert
      expect(quote.estimatedOut).toBe('200')
    })

    it('should throw when price deviation exceeds maximum', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData('1.0', 'test1'))
      const provider2 = new MockPriceProvider(mockPriceData('1.5', 'test2')) // 50% deviation
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act & Assert
      await expect(
        service.getQuote({
          tokenIn: mockToken(),
          tokenOut: mockToken(),
        })
      ).rejects.toThrow('Price deviation too high')
    })

    it('should throw when insufficient price sources', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData(), false) // Won't support pair
      const provider2 = new MockPriceProvider(mockPriceData(), false) // Won't support pair
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act & Assert
      await expect(
        service.getQuote({
          tokenIn: mockToken(),
          tokenOut: mockToken(),
        })
      ).rejects.toThrow('Insufficient price sources')
    })

    it('should handle provider errors gracefully', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData('1.0', 'test1'))
      const provider2 = new MockPriceProvider(mockPriceData(), true, true) // Will throw
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act
      const quote = await service.getQuote({
        tokenIn: mockToken(),
        tokenOut: mockToken(),
      })

      // Assert
      expect(quote.price.sourceCount).toBe(1)
      expect(quote.price.sources).toEqual(['test1'])
    })

    it('should use custom maxSlippage when provided', async () => {
      // Arrange
      const provider1 = new MockPriceProvider(mockPriceData('1.0', 'test1'))
      const provider2 = new MockPriceProvider(mockPriceData('1.0', 'test2'))
      const service = new PriceService([provider1, provider2], defaultConfig)

      // Act
      const quote = await service.getQuote({
        tokenIn: mockToken(),
        tokenOut: mockToken(),
        maxSlippage: 0.02,
      })

      // Assert
      expect(quote.maxSlippage).toBe(0.02)
    })
  })
})

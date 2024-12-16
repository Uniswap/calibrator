import { CoinGeckoProvider } from '../../providers/CoinGeckoProvider'
import { mockToken } from '../testUtils'
import { CoinGeckoConfig } from '../../interfaces/ICoinGeckoProvider'

describe('CoinGeckoProvider', () => {
  const defaultConfig: CoinGeckoConfig = {
    apiUrl: 'https://api.coingecko.com/api/v3',
    cacheDurationMs: 60000,
  }

  describe('getUsdPrice', () => {
    it('should throw not implemented error', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const token = mockToken(1, '0x1')

      // Act & Assert
      await expect(provider.getUsdPrice(token)).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  describe('getSupportedPlatforms', () => {
    it('should throw not implemented error', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)

      // Act & Assert
      await expect(provider.getSupportedPlatforms()).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  describe('getPrice', () => {
    it('should throw when USD prices are not available', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const tokenA = mockToken(1, '0x1')
      const tokenB = mockToken(1, '0x2')

      // Act & Assert
      await expect(provider.getPrice(tokenA, tokenB)).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  describe('supportsPair', () => {
    it('should return false when platform fetch fails', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const tokenA = mockToken(1, '0x1')
      const tokenB = mockToken(1, '0x2')

      // Act
      const result = await provider.supportsPair(tokenA, tokenB)

      // Assert
      expect(result).toBe(false)
    })
  })

  // Add more tests once actual implementation is added
})

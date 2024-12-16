import { UniswapProvider } from '../../providers/UniswapProvider'
import { mockToken } from '../testUtils'
import { UniswapConfig } from '../../interfaces/IUniswapProvider'

describe('UniswapProvider', () => {
  const defaultConfig: UniswapConfig = {
    apiUrl: 'https://api.uniswap.org/v1',
    cacheDurationMs: 60000,
  }

  describe('getUniswapPrice', () => {
    it('should throw not implemented error', async () => {
      // Arrange
      const provider = new UniswapProvider(defaultConfig)
      const tokenA = mockToken(1, '0x1')
      const tokenB = mockToken(1, '0x2')

      // Act & Assert
      await expect(provider.getUniswapPrice(tokenA, tokenB)).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  describe('hasDirectPool', () => {
    it('should throw not implemented error', async () => {
      // Arrange
      const provider = new UniswapProvider(defaultConfig)
      const tokenA = mockToken(1, '0x1')
      const tokenB = mockToken(1, '0x2')

      // Act & Assert
      await expect(provider.hasDirectPool(tokenA, tokenB)).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  // Add more tests once actual implementation is added
})

import { CoinGeckoProvider } from '../../providers/CoinGeckoProvider'
import { mockToken } from '../testUtils'
import { CoinGeckoConfig } from '../../interfaces/ICoinGeckoProvider'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('CoinGeckoProvider', () => {
  const defaultConfig: CoinGeckoConfig = {
    apiUrl: 'https://api.coingecko.com/api/v3',
    cacheDurationMs: 30000,
  }

  const proConfig: CoinGeckoConfig = {
    apiUrl: 'https://pro-api.coingecko.com/api/v3',
    apiKey: 'test-api-key',
    cacheDurationMs: 30000,
  }

  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('getUsdPrice', () => {
    it('should fetch ETH price successfully', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ethereum: { usd: 4039.64 } }),
      })

      // Act
      const result = await provider.getUsdPrice(ethToken)

      // Assert
      expect(result.price).toBe('4039639999999999737856') // 4039.64 in wei
      expect(result.source).toBe('coingecko')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        expect.any(Object)
      )
    })

    it('should fetch token price successfully', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const usdcToken = mockToken(
        1,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        6,
        'USDC'
      )

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { usd: 0.999597 },
        }),
      })

      // Act
      const result = await provider.getUsdPrice(usdcToken)

      // Assert
      expect(result.price).toBe('999597000000000000') // 0.999597 in wei
      expect(result.source).toBe('coingecko')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&vs_currencies=usd',
        expect.any(Object)
      )
    })

    it('should use pro API when API key is provided', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(proConfig)
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ethereum: { usd: 4039.64 } }),
      })

      // Act
      await provider.getUsdPrice(ethToken)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://pro-api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-cg-pro-api-key': 'test-api-key',
          }),
        })
      )
    })

    it('should use cache for subsequent requests', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ethereum: { usd: 4039.64 } }),
      })

      // Act
      const result1 = await provider.getUsdPrice(ethToken)
      const result2 = await provider.getUsdPrice(ethToken)

      // Assert
      expect(result1).toEqual(result2)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should refresh cache after duration', async () => {
      // Arrange
      const provider = new CoinGeckoProvider({
        ...defaultConfig,
        cacheDurationMs: 0, // Force cache refresh
      })
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ethereum: { usd: 4039.64 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ethereum: { usd: 4040 } }),
        })

      // Act
      const result1 = await provider.getUsdPrice(ethToken)
      const result2 = await provider.getUsdPrice(ethToken)

      // Assert
      expect(result1.price).toBe('4039639999999999737856') // 4039.64 in wei
      expect(result2.price).toBe('4040000000000000000000') // 4040 in wei
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle API errors', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Rate limit exceeded',
      })

      // Act & Assert
      await expect(provider.getUsdPrice(ethToken)).rejects.toThrow(
        'Failed to fetch ETH price: Rate limit exceeded'
      )
    })

    it('should handle missing token price data', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const unknownToken = mockToken(1, '0xdeadbeef', 18, 'UNKNOWN')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Act & Assert
      await expect(provider.getUsdPrice(unknownToken)).rejects.toThrow(
        'No price data available for token 0xdeadbeef'
      )
    })

    it('should reject unsupported chains', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const polygonToken = mockToken(137, '0x1234', 18, 'TEST')

      // Act & Assert
      await expect(provider.getUsdPrice(polygonToken)).rejects.toThrow(
        'Unsupported chain ID: 137'
      )
    })
  })

  describe('getPrice', () => {
    it('should calculate relative price between tokens', async () => {
      // Arrange
      const provider = new CoinGeckoProvider(defaultConfig)
      const ethToken = mockToken(
        1,
        '0x0000000000000000000000000000000000000000',
        18,
        'ETH'
      )
      const usdcToken = mockToken(
        1,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        6,
        'USDC'
      )

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ethereum: { usd: 4000 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { usd: 1 },
          }),
        })

      // Act
      const result = await provider.getPrice(ethToken, usdcToken)

      // Assert
      expect(result.price).toBe('4000000000') // 4000 USDC (with 6 decimals)
      expect(result.source).toBe('coingecko')
    })
  })
})

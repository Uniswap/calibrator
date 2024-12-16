import { FastifyInstance } from 'fastify'
import { build } from '../../app.js'
import { PriceService } from '../../services/price/PriceService.js'
import {
  mockToken,
  mockPriceData,
  MockPriceProvider,
} from '../../services/price/__tests__/testUtils.js'
import { PriceServiceConfig } from '../../services/price/types.js'
import { quoteRoutes } from '../../routes/quote.js'

describe('Quote Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await build({ registerRoutes: false })
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /quote', () => {
    it('should return price quote for valid tokens', async () => {
      // Set up mock provider that will return a valid price
      const provider = new MockPriceProvider(
        mockPriceData('1.0', 'test'),
        true, // supports pair
        false // won't throw
      )

      const config: PriceServiceConfig = {
        maxPriceDeviation: 0.01,
        cacheDurationMs: 60000,
        minSourcesRequired: 1,
        maxSlippage: 0.01,
      }

      const service = new PriceService([provider], config)

      // Register quote routes with our mock price service
      await app.register(async fastify => {
        await quoteRoutes(fastify, service)
      })

      const payload = {
        tokenIn: mockToken(1, '0x1'),
        tokenOut: mockToken(1, '0x2'),
        amountIn: '100',
        maxSlippage: 0.01,
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload,
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.price).toBeDefined()
      expect(result.price.price).toBe('1.0')
      expect(result.estimatedOut).toBe('100')
    })

    it('should validate request payload', async () => {
      // Set up mock provider
      const provider = new MockPriceProvider()
      const service = new PriceService([provider], {
        maxPriceDeviation: 0.01,
        cacheDurationMs: 60000,
        minSourcesRequired: 1,
        maxSlippage: 0.01,
      })

      // Register quote routes
      await app.register(async fastify => {
        await quoteRoutes(fastify, service)
      })

      // Arrange
      const invalidPayload = {
        tokenIn: {
          // Missing required fields
          chainId: 1,
        },
        tokenOut: mockToken(1, '0x2'),
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload: invalidPayload,
      })

      // Assert
      expect(response.statusCode).toBe(400)
    })

    it('should handle price service errors', async () => {
      // Set up mock provider that will throw
      const provider = new MockPriceProvider(
        mockPriceData(),
        false, // doesn't support pair
        false // won't throw
      )

      const service = new PriceService([provider], {
        maxPriceDeviation: 0.01,
        cacheDurationMs: 60000,
        minSourcesRequired: 1,
        maxSlippage: 0.01,
      })

      // Register quote routes
      await app.register(async fastify => {
        await quoteRoutes(fastify, service)
      })

      const payload = {
        tokenIn: mockToken(1, '0x1'),
        tokenOut: mockToken(1, '0x2'),
        amountIn: '100',
      }

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/quote',
        payload,
      })

      // Assert
      expect(response.statusCode).toBe(400)
      const error = JSON.parse(response.payload)
      expect(error.error).toBe(
        'Insufficient price sources. Required: 1, Found: 0'
      )
    })
  })
})

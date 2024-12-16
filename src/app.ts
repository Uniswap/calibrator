import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { join } from 'path'
import fastifyStatic from '@fastify/static'
import { UniswapProvider } from './services/price/providers/UniswapProvider.js'
import { CoinGeckoProvider } from './services/price/providers/CoinGeckoProvider.js'
import { PriceService } from './services/price/PriceService.js'
import { quoteRoutes } from './routes/quote.js'

// Configuration (should be moved to config file in production)
const config = {
  uniswap: {
    apiUrl: process.env.UNISWAP_API_URL || 'https://api.uniswap.org/v1',
    apiKey: process.env.UNISWAP_API_KEY,
    cacheDurationMs: 60000,
  },
  coingecko: {
    apiUrl: process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
    apiKey: process.env.COINGECKO_API_KEY,
    cacheDurationMs: 60000,
  },
  priceService: {
    maxPriceDeviation: 0.01,
    cacheDurationMs: 60000,
    minSourcesRequired: 1,
  },
}

interface BuildOptions {
  registerRoutes?: boolean
}

export async function build(
  options: BuildOptions = { registerRoutes: true }
): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
  })

  // Register CORS
  await app.register(cors, {
    origin: true,
  })

  // Serve static frontend files
  await app.register(fastifyStatic, {
    root: join(process.cwd(), '..', 'dist', 'public'),
    prefix: '/',
  })

  if (options.registerRoutes) {
    // Initialize price providers
    const uniswapProvider = new UniswapProvider(config.uniswap)
    const coingeckoProvider = new CoinGeckoProvider(config.coingecko)

    // Initialize price service
    const priceService = new PriceService(
      [uniswapProvider, coingeckoProvider],
      config.priceService
    )

    // Register routes
    await app.register(async fastify => {
      await quoteRoutes(fastify, priceService)
    })
  }

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}

export default build

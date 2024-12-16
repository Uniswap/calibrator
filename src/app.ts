import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { join } from 'path'
import fastifyStatic from '@fastify/static'
import { UniswapProvider } from './services/price/providers/UniswapProvider.js'
import { CoinGeckoProvider } from './services/price/providers/CoinGeckoProvider.js'
import { PriceService } from './services/price/PriceService.js'
import { quoteRoutes } from './routes/quote.js'

interface BuildOptions {
  registerRoutes?: boolean
}

export async function build(
  options: BuildOptions = { registerRoutes: true }
): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
  })

  // Initialize Fastify plugins
  await app.register(cors)
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'dist/public'),
    prefix: '/',
  })

  if (options.registerRoutes) {
    // Initialize price providers
    const coinGeckoProvider = new CoinGeckoProvider({
      apiUrl: 'https://pro-api.coingecko.com/api/v3',
      apiKey: process.env.COINGECKO_API_KEY,
      cacheDurationMs: 30000,
    })

    const uniswapProvider = new UniswapProvider({
      apiUrl: 'https://api.uniswap.org/v1',
      apiKey: process.env.UNISWAP_API_KEY,
      cacheDurationMs: 30000,
    })

    // Initialize price service
    const priceService = new PriceService(
      [coinGeckoProvider, uniswapProvider],
      {
        minSourcesRequired: 1,
        cacheDurationMs: 30000,
        maxPriceDeviation: 0.05, // 5% maximum price deviation
      }
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

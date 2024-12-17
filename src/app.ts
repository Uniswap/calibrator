import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { join } from 'path'
import fastifyStatic from '@fastify/static'
import { CoinGeckoProvider } from './services/price/providers/CoinGeckoProvider.js'
import { UniswapProvider } from './services/price/providers/UniswapProvider.js'
import { QuoteService } from './services/price/QuoteService.js'
import { quoteRoutes } from './routes/quote.js'
import { healthRoutes } from './routes/health.js'
import { Logger } from './utils/logger.js'

interface BuildOptions {
  coinGeckoProvider?: CoinGeckoProvider
  uniswapProvider?: UniswapProvider
  quoteService?: QuoteService
}

export async function build(
  options: BuildOptions = {}
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
    root: join(process.cwd(), 'dist/public'),
    prefix: '/',
  })

  // Configure providers
  const coinGeckoProvider =
    options.coinGeckoProvider ||
    new CoinGeckoProvider({
      apiUrl: 'https://pro-api.coingecko.com/api/v3',
      apiKey: process.env.COINGECKO_API_KEY,
      cacheDurationMs: 30000, // 30 seconds
    })

  const uniswapProvider =
    options.uniswapProvider ||
    new UniswapProvider({
      apiUrl: 'https://trade-api.gateway.uniswap.org',
      apiKey: process.env.UNISWAP_API_KEY,
      cacheDurationMs: 30000, // 30 seconds
    })

  // Initialize QuoteService
  const quoteService =
    options.quoteService ||
    new QuoteService(
      coinGeckoProvider,
      uniswapProvider,
      new Logger('QuoteService')
    )

  if (!options.quoteService) {
    await quoteService.initialize()
  }

  // Register routes
  await healthRoutes(app)
  await quoteRoutes(app, quoteService)

  return app
}

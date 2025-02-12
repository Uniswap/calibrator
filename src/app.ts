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
import { TribunalService } from './services/quote/TribunalService.js'

interface BuildOptions {
  coinGeckoProvider?: CoinGeckoProvider
  uniswapProvider?: UniswapProvider
  quoteService?: QuoteService
}

export async function build(
  options: BuildOptions = {}
): Promise<FastifyInstance> {
  const logger = new Logger('App')
  const app = fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  })

  // Register CORS
  await app.register(cors, {
    origin: true,
  })

  // Serve static frontend files
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'dist', 'public'),
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
  // Initialize TribunalService
  const tribunalService = new TribunalService()

  const quoteService =
    options.quoteService ||
    new QuoteService(coinGeckoProvider, uniswapProvider, tribunalService)

  if (!options.quoteService) {
    await quoteService.initialize()
  }

  // Register routes
  await app.register(async function (fastify) {
    await healthRoutes(fastify)
    await quoteRoutes(fastify, quoteService)
  })

  // Log registered routes for debugging
  app.ready(() => {
    logger.info('Registered routes:')
    console.log(app.printRoutes())
  })

  return app
}

import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const server: FastifyInstance = fastify({
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

// Register plugins
await server.register(cors, {
  origin: true,
})

// Serve static frontend files
await server.register(fastifyStatic, {
  root: join(__dirname, '..', 'dist', 'public'),
  prefix: '/',
})

// Health check endpoint
server.get('/health', async (_request, _reply) => {
  return { status: 'ok' }
})

try {
  await server.listen({ port: 3000 })
  console.log('Server listening on port 3000')
} catch (err) {
  server.log.error(err)
  process.exit(1)
}

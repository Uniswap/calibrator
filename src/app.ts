import fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { join } from 'path'
import fastifyStatic from '@fastify/static'

export async function build(): Promise<FastifyInstance> {
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

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}

export default build

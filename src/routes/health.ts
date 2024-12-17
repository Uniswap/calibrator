import { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'number' },
          },
        },
      },
    },
    handler: async () => {
      return {
        status: 'ok',
        timestamp: Date.now(),
      }
    },
  })
}

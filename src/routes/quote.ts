import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { QuoteService } from '../services/price/QuoteService.js'

const QuoteRequestSchema = Type.Object({
  inputTokenChainId: Type.Number(),
  inputTokenAddress: Type.String(),
  inputTokenAmount: Type.String(),
  outputTokenChainId: Type.Number(),
  outputTokenAddress: Type.String(),
})

type QuoteRequest = Static<typeof QuoteRequestSchema>

export async function quoteRoutes(
  fastify: FastifyInstance,
  quoteService: QuoteService
): Promise<void> {
  fastify.post<{ Body: QuoteRequest }>(
    '/quote',
    {
      schema: {
        body: QuoteRequestSchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: QuoteRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const quote = await quoteService.getQuote(request.body)
        reply.send(quote)
      } catch (error) {
        fastify.log.error(error)
        reply.code(400).send({ error: (error as Error).message })
      }
    }
  )
}

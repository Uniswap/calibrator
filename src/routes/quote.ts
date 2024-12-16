import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { PriceService } from '../services/price/PriceService.js'

const TokenSchema = Type.Object({
  address: Type.String(),
  chainId: Type.Number(),
  decimals: Type.Number(),
  symbol: Type.String(),
})

const QuoteRequestSchema = Type.Object({
  tokenIn: TokenSchema,
  tokenOut: TokenSchema,
  amountIn: Type.Optional(Type.String()),
  maxSlippage: Type.Optional(Type.Number()),
})

type QuoteRequest = Static<typeof QuoteRequestSchema>

export async function quoteRoutes(
  fastify: FastifyInstance,
  priceService: PriceService
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
        const quote = await priceService.getQuote({
          tokenIn: request.body.tokenIn,
          tokenOut: request.body.tokenOut,
          amountIn: request.body.amountIn,
          maxSlippage: request.body.maxSlippage,
        })
        reply.send(quote)
      } catch (error) {
        fastify.log.error(error)
        reply.code(400).send({ error: (error as Error).message })
      }
    }
  )
}

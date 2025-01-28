import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { QuoteService } from '../services/price/QuoteService.js'
import { QuoteConfigurationService } from '../services/quote/QuoteConfigurationService.js'
import { arbiterMapping } from '../config/arbiters.js'
import { LockParameters, QuoteContext } from '../types/quote.js'

const QuoteRequestSchema = Type.Object({
  inputTokenChainId: Type.Number(),
  inputTokenAddress: Type.String(),
  inputTokenAmount: Type.String(),
  outputTokenChainId: Type.Number(),
  outputTokenAddress: Type.String(),
  lockParameters: Type.Optional(
    Type.Object({
      allocatorId: Type.String(),
      resetPeriod: Type.Number(),
      isMultichain: Type.Boolean(),
    })
  ),
  context: Type.Optional(
    Type.Object({
      slippageBips: Type.Optional(Type.Number()),
      recipient: Type.Optional(Type.String()),
      baselinePriorityFee: Type.Optional(Type.String()),
      scalingFactor: Type.Optional(Type.String()),
      expires: Type.Optional(Type.String()),
    })
  ),
})

type QuoteRequest = Static<typeof QuoteRequestSchema>

// Helper function to convert bigint values to strings in an object
function convertBigIntsToStrings<T>(obj: T): T extends bigint
  ? string
  : T extends Array<infer U>
    ? Array<U>
    : T extends object
      ? {
          [K in keyof T]: T[K] extends bigint
            ? string
            : T[K] extends object
              ? ReturnType<typeof convertBigIntsToStrings<T[K]>>
              : T[K]
        }
      : T {
  if (obj === null || obj === undefined) {
    return obj as any
  }
  if (typeof obj === 'bigint') {
    return obj.toString() as any
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings) as any
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      result[key] = convertBigIntsToStrings((obj as any)[key])
    }
    return result as any
  }
  return obj as any
}

export async function quoteRoutes(
  fastify: FastifyInstance,
  quoteService: QuoteService
): Promise<void> {
  const quoteConfigService = new QuoteConfigurationService(arbiterMapping)

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
        const rawQuote = await quoteService.getQuote(request.body)
        const quote = convertBigIntsToStrings(rawQuote)

        // Ensure we have an output amount
        const outputAmount = quote.spotOutputAmount || quote.quoteOutputAmount
        if (!outputAmount) {
          throw new Error(
            'Failed to get output amount from either spot or quote price'
          )
        }

        // Default values for lockParameters and context
        const lockParameters: LockParameters = {
          allocatorId: request.body.lockParameters?.allocatorId
            ? BigInt(request.body.lockParameters.allocatorId)
            : 0n,
          resetPeriod: request.body.lockParameters?.resetPeriod ?? 0,
          isMultichain: request.body.lockParameters?.isMultichain ?? false,
        }

        const context: QuoteContext = {
          slippageBips: request.body.context?.slippageBips,
          recipient: request.body.context?.recipient as
            | `0x${string}`
            | undefined,
          baselinePriorityFee: request.body.context?.baselinePriorityFee
            ? BigInt(request.body.context.baselinePriorityFee)
            : undefined,
          scalingFactor: request.body.context?.scalingFactor
            ? BigInt(request.body.context.scalingFactor)
            : undefined,
          expires: request.body.context?.expires
            ? BigInt(request.body.context.expires)
            : undefined,
        }

        // Convert amounts to bigint
        const quoteWithBigInt = {
          inputChainId: quote.inputTokenChainId,
          outputChainId: quote.outputTokenChainId,
          inputToken: quote.inputTokenAddress as `0x${string}`,
          outputToken: quote.outputTokenAddress as `0x${string}`,
          inputAmount: BigInt(quote.inputTokenAmount),
          outputAmount: BigInt(outputAmount),
          tribunalQuote: rawQuote.tribunalQuote ? BigInt(rawQuote.tribunalQuote) : null,
        }

        // Generate arbiter configuration
        const arbiterConfiguration =
          await quoteConfigService.generateConfiguration(
            quoteWithBigInt,
            '0x0000000000000000000000000000000000000000', // Default sponsor
            3600, // 1 hour duration
            lockParameters,
            context
          )

        // Convert all BigInt values to strings before sending response
        const response = {
          ...quote,
          arbiterConfiguration: convertBigIntsToStrings(arbiterConfiguration),
        }

        reply.send(response)
      } catch (error) {
        fastify.log.error(error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        reply.code(400).send({ message })
      }
    }
  )
}

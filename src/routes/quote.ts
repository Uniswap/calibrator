import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { QuoteService } from '../services/price/QuoteService.js'
import { QuoteConfigurationService } from '../services/quote/QuoteConfigurationService.js'
import { arbiterMapping } from '../config/arbiters.js'
import { LockParameters, QuoteContext, Quote } from '../types/quote.js'

// Define the request schema that matches the service types
interface ServiceQuoteRequest {
  inputTokenChainId: number
  outputTokenChainId: number
  inputTokenAddress: string
  outputTokenAddress: string
  inputTokenAmount: string
  lockParameters?: LockParameters
  context?: QuoteContext
}

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

type RequestBody = Static<typeof QuoteRequestSchema>

// Helper function to convert bigint values to strings in an object
function convertBigIntsToStrings<T>(obj: T): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings)
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertBigIntsToStrings(
          (obj as Record<string, unknown>)[key]
        )
      }
    }
    return result
  }

  return obj
}

export async function quoteRoutes(
  fastify: FastifyInstance,
  quoteService: QuoteService
): Promise<void> {
  const quoteConfigService = new QuoteConfigurationService(arbiterMapping)

  fastify.post<{ Body: RequestBody }>(
    '/quote',
    {
      schema: {
        body: QuoteRequestSchema,
      },
    },
    async (
      request: FastifyRequest<{ Body: RequestBody }>,
      reply: FastifyReply
    ) => {
      try {
        // Convert request body to service types
        const serviceRequest: ServiceQuoteRequest = {
          inputTokenChainId: request.body.inputTokenChainId,
          outputTokenChainId: request.body.outputTokenChainId,
          inputTokenAddress: request.body.inputTokenAddress,
          outputTokenAddress: request.body.outputTokenAddress,
          inputTokenAmount: request.body.inputTokenAmount.toString(),
          lockParameters: request.body.lockParameters
            ? {
                allocatorId: request.body.lockParameters.allocatorId,
                resetPeriod: request.body.lockParameters.resetPeriod,
                isMultichain: request.body.lockParameters.isMultichain,
              }
            : undefined,
          context: request.body.context
            ? {
                slippageBips: request.body.context.slippageBips,
                recipient: request.body.context.recipient,
                baselinePriorityFee: request.body.context.baselinePriorityFee,
                scalingFactor: request.body.context.scalingFactor,
                expires: request.body.context.expires,
              }
            : undefined,
        }

        const rawQuote = await quoteService.getQuote(serviceRequest)
        const quote = convertBigIntsToStrings(rawQuote) as typeof rawQuote

        // Ensure we have an output amount
        const outputAmount = quote.spotOutputAmount || quote.quoteOutputAmount
        if (!outputAmount) {
          throw new Error(
            'Failed to get output amount from either spot or quote price'
          )
        }

        // Prepare quote for configuration service
        const quoteForConfig: Quote = {
          inputTokenChainId: quote.inputTokenChainId,
          outputTokenChainId: quote.outputTokenChainId,
          inputTokenAddress: quote.inputTokenAddress,
          outputTokenAddress: quote.outputTokenAddress,
          inputTokenAmount: quote.inputTokenAmount,
          outputTokenAmount: outputAmount,
          tribunalQuote: rawQuote.tribunalQuote,
          tribunalQuoteUsd: rawQuote.tribunalQuoteUsd,
        }

        // Generate arbiter configuration
        const arbiterConfiguration =
          await quoteConfigService.generateConfiguration(
            quoteForConfig,
            '0x0000000000000000000000000000000000000000', // Default sponsor
            3600, // 1 hour duration
            serviceRequest.lockParameters || {
              allocatorId: '0',
              resetPeriod: 0,
              isMultichain: false,
            },
            serviceRequest.context || {
              slippageBips: undefined,
              recipient: undefined,
              baselinePriorityFee: undefined,
              scalingFactor: undefined,
              expires: undefined,
            }
          )

        // Convert all BigInt values to strings before sending response
        const convertedConfig = convertBigIntsToStrings(
          arbiterConfiguration
        ) as Record<string, unknown>
        const response = {
          arbiterConfiguration: {
            data: convertedConfig.data,
            witnessHash: convertedConfig.witnessHash,
          },
          dispensation: rawQuote.tribunalQuote,
          dispensationUSD: rawQuote.tribunalQuoteUsd
            ? `$${(Number(BigInt(rawQuote.tribunalQuoteUsd)) / Math.pow(10, 18)).toFixed(4)}`
            : null,
          spotOutputAmount: rawQuote.spotOutputAmount,
          quoteOutputAmount: rawQuote.quoteOutputAmount,
          deltaAmount: rawQuote.deltaAmount,
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

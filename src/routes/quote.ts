import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Type, Static } from '@sinclair/typebox'
import { QuoteService } from '../services/price/QuoteService.js'
import { QuoteConfigurationService } from '../services/quote/QuoteConfigurationService.js'
import { arbiterMapping } from '../config/arbiters.js'
import { LockParameters, QuoteContext, Quote } from '../types/quote.js'

// Define the request schema that matches the service types
interface ServiceQuoteRequest {
  sponsor: string
  inputTokenChainId: number
  outputTokenChainId: number
  inputTokenAddress: string
  outputTokenAddress: string
  inputTokenAmount: string
  lockParameters?: LockParameters
  context?: QuoteContext
}

const QuoteRequestSchema = Type.Object({
  sponsor: Type.RegEx(/^0x[a-fA-F0-9]{40}$/),
  inputTokenChainId: Type.Number(),
  inputTokenAddress: Type.RegEx(/^0x[a-fA-F0-9]{40}$/),
  inputTokenAmount: Type.String(),
  outputTokenChainId: Type.Number(),
  outputTokenAddress: Type.RegEx(/^0x[a-fA-F0-9]{40}$/),
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
      fillExpires: Type.Optional(Type.String()),
      claimExpires: Type.Optional(Type.String()),
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
          sponsor: request.body.sponsor,
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
                fillExpires: request.body.context.fillExpires,
                claimExpires: request.body.context.claimExpires,
              }
            : undefined,
        }

        const rawQuote = await quoteService.getQuote(serviceRequest)
        const quote = convertBigIntsToStrings(rawQuote) as typeof rawQuote

        // Prepare quote for configuration service
        const quoteForConfig: Quote = {
          sponsor: serviceRequest.sponsor,
          inputTokenChainId: quote.inputTokenChainId,
          outputTokenChainId: quote.outputTokenChainId,
          inputTokenAddress: quote.inputTokenAddress,
          outputTokenAddress: quote.outputTokenAddress,
          inputTokenAmount: quote.inputTokenAmount,
          outputAmountDirect:
            quote.quoteOutputAmountDirect || quote.spotOutputAmount,
          outputAmountNet: quote.quoteOutputAmountNet || quote.spotOutputAmount,
          tribunalQuote: rawQuote.tribunalQuote,
          tribunalQuoteUsd: rawQuote.tribunalQuoteUsd,
        }

        // Ensure we have an output amount
        if (!quoteForConfig.outputAmountNet) {
          throw new Error(
            'Failed to get output amount from either spot or quote price'
          )
        }

        // Generate arbiter configuration
        const arbiterConfiguration =
          await quoteConfigService.generateConfiguration(
            quoteForConfig,
            serviceRequest.sponsor as `0x${string}`,
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
              fillExpires: undefined,
              claimExpires: undefined,
            }
          )

        // Convert all BigInt values to strings before sending response
        const convertedConfig = convertBigIntsToStrings(
          arbiterConfiguration
        ) as Record<string, unknown>
        // Extract data from convertedConfig
        const { ...configData } = convertedConfig.data as Record<
          string,
          {
            arbiter: string
            sponsor: string
            nonce: string | null
            expires: string
            id: string
            amount: string
            mandate: {
              chainId: number
              tribunal: string
              recipient: string
              expires: string
              token: string
              minimumAmount: string
              baselinePriorityFee: string
              scalingFactor: string
              salt: string
            }
          }
        >

        const response = {
          data: {
            arbiter: configData.arbiter,
            sponsor: configData.sponsor,
            nonce: configData.nonce,
            expires: configData.expires,
            id: configData.id,
            amount: configData.amount,
            mandate: configData.mandate,
          },
          context: {
            dispensation: rawQuote.tribunalQuote,
            dispensationUSD: rawQuote.tribunalQuoteUsd
              ? `$${(Number(BigInt(rawQuote.tribunalQuoteUsd)) / Math.pow(10, 18)).toFixed(4)}`
              : null,
            spotOutputAmount: rawQuote.spotOutputAmount,
            quoteOutputAmountDirect: rawQuote.quoteOutputAmountDirect,
            quoteOutputAmountNet: rawQuote.quoteOutputAmountNet,
            deltaAmount: rawQuote.deltaAmount,
            witnessHash: convertedConfig.witnessHash,
          },
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

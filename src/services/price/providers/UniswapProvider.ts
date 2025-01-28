import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import {
  IUniswapProvider,
  UniswapConfig,
} from '../interfaces/IUniswapProvider.js'
import {
  IndicativeQuoteRequest,
  IndicativeQuoteResponse,
} from '../types/uniswap.js'
import { Logger } from '../../../utils/logger.js'

const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'

export class UniswapProvider implements IUniswapProvider {
  private config: UniswapConfig
  private logger: Logger

  constructor(
    config: UniswapConfig,
    logger: Logger = new Logger('UniswapProvider')
  ) {
    this.config = config
    this.logger = logger
  }

  private async fetchIndicativeQuote(
    tokenIn: Token,
    tokenOut: Token,
    amount: string,
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT' = 'EXACT_INPUT'
  ): Promise<IndicativeQuoteResponse> {
    const request: IndicativeQuoteRequest = {
      type,
      tokenInChainId: tokenIn.chainId,
      tokenOutChainId: tokenOut.chainId,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amount,
    }

    this.logger.info(
      `Sending request to Uniswap API: ${JSON.stringify(request)}`
    )

    const response = await fetch(`${this.config.apiUrl}/v1/indicative_quote`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Uniswap API error: ${error}`)
    }

    const data = (await response.json()) as IndicativeQuoteResponse
    this.logger.info(
      `Received response from Uniswap API: ${JSON.stringify(data)}`
    )
    return data
  }

  async hasDirectPool(tokenA: Token, tokenB: Token): Promise<boolean> {
    try {
      // Try to get a quote for a small amount to check if the pair exists
      await this.fetchIndicativeQuote(tokenA, tokenB, '1000000') // 1 USDC worth
      return true
    } catch (error) {
      this.logger.error(`Error checking pool existence: ${error}`)
      return false
    }
  }

  async getPrice(tokenIn: Token, tokenOut: Token): Promise<PriceData> {
    return this.getUniswapPrice(tokenIn, tokenOut)
  }

  async supportsPair(tokenA: Token, tokenB: Token): Promise<boolean> {
    return this.hasDirectPool(tokenA, tokenB)
  }

  async getUniswapPrice(
    tokenIn: Token,
    tokenOut: Token,
    amount?: string,
    dispensationAmount?: string
  ): Promise<PriceData & {
    poolAddress?: string;
    liquidity?: string;
    outputAmountDirect?: string;
    outputAmountNet?: string;
  }> {
    try {
      // Use 1 ETH as the default amount if not specified
      const defaultAmount = '1000000000000000000' // 1 ETH in wei
      const inputAmount = amount || defaultAmount

      // If both tokens are native (address(0)), handle dispensation directly
      if (
        tokenIn.address === NATIVE_TOKEN &&
        tokenOut.address === NATIVE_TOKEN
      ) {
        const netAmount = dispensationAmount
          ? (BigInt(inputAmount) - BigInt(dispensationAmount)).toString()
          : inputAmount;

        return {
          price: netAmount,
          outputAmountDirect: inputAmount,
          outputAmountNet: netAmount,
          source: 'uniswap',
          timestamp: Date.now(),
        }
      }

      // If on different chains, handle cross-chain quote
      if (tokenIn.chainId !== tokenOut.chainId) {
        return this.getCrossChainPrice(tokenIn, tokenOut, inputAmount, dispensationAmount)
      }

      // Same chain quote
      const quote = await this.fetchIndicativeQuote(
        tokenIn,
        tokenOut,
        inputAmount
      )

      if (!quote?.output?.amount) {
        throw new Error('Invalid quote response from Uniswap API')
      }

      // For same-chain quotes, direct and net are the same since there's no intermediate step
      const outputAmount = quote.output.amount
      return {
        price: outputAmount,
        outputAmountDirect: outputAmount,
        outputAmountNet: outputAmount,
        source: 'uniswap',
        timestamp: Date.now(),
      }
    } catch (error) {
      this.logger.error(`Error fetching Uniswap price: ${error}`)
      throw error
    }
  }

  private async getCrossChainPrice(
    tokenIn: Token,
    tokenOut: Token,
    amount: string,
    dispensationAmount?: string
  ): Promise<PriceData & {
    poolAddress?: string;
    liquidity?: string;
    outputAmountDirect?: string;
    outputAmountNet?: string;
  }> {
    // Create native token objects for both chains
    const nativeTokenIn: Token = {
      ...tokenIn,
      address: NATIVE_TOKEN,
    }
    const nativeTokenOut: Token = {
      ...tokenOut,
      address: NATIVE_TOKEN,
    }

    let firstQuoteAmount: string | undefined
    let secondQuoteAmount: string | undefined

    // Handle input side if not native
    if (tokenIn.address !== NATIVE_TOKEN) {
      const inputQuote = await this.fetchIndicativeQuote(
        tokenIn,
        nativeTokenIn,
        amount
      )
      firstQuoteAmount = inputQuote.output.amount
    } else {
      firstQuoteAmount = amount
    }

    // Calculate net amount after dispensation
    let netAmount = firstQuoteAmount
    if (dispensationAmount) {
      const firstQuoteBN = BigInt(firstQuoteAmount)
      const dispensationBN = BigInt(dispensationAmount)
      
      if (dispensationBN >= firstQuoteBN) {
        throw new Error('Dispensation amount exceeds intermediate quote amount')
      }
      
      netAmount = (firstQuoteBN - dispensationBN).toString()
    }

    // Handle output side if not native
    let directAmount: string
    if (tokenOut.address !== NATIVE_TOKEN) {
      // Get direct quote using full intermediate amount
      const directQuote = await this.fetchIndicativeQuote(
        nativeTokenOut,
        tokenOut,
        firstQuoteAmount
      )
      directAmount = directQuote.output.amount

      // Get net quote using amount after dispensation
      const netQuote = await this.fetchIndicativeQuote(
        nativeTokenOut,
        tokenOut,
        netAmount
      )
      secondQuoteAmount = netQuote.output.amount
    } else {
      directAmount = firstQuoteAmount
      secondQuoteAmount = netAmount
    }

    if (!secondQuoteAmount || !directAmount) {
      throw new Error('Failed to calculate cross-chain quote')
    }

    return {
      price: secondQuoteAmount, // Use net amount as primary price
      outputAmountDirect: directAmount,
      outputAmountNet: secondQuoteAmount,
      source: 'uniswap',
      timestamp: Date.now(),
    }
  }
}

import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import {
  IUniswapProvider,
  UniswapConfig,
} from '../interfaces/IUniswapProvider.js'

export class UniswapProvider implements IUniswapProvider {
  private config: UniswapConfig

  constructor(config: UniswapConfig) {
    this.config = config
  }

  async hasDirectPool(_tokenA: Token, _tokenB: Token): Promise<boolean> {
    // TODO: Implement pool existence check
    throw new Error('Pool checking not yet implemented')
  }

  async getPrice(_tokenA: Token, _tokenB: Token): Promise<PriceData> {
    // TODO: Implement actual Uniswap API integration
    throw new Error('Uniswap price fetching not yet implemented')
  }

  async supportsPair(_tokenA: Token, _tokenB: Token): Promise<boolean> {
    try {
      return await this.hasDirectPool(_tokenA, _tokenB)
    } catch {
      return false
    }
  }

  async getUniswapPrice(
    _tokenA: Token,
    _tokenB: Token,
    _amount?: string
  ): Promise<PriceData & { poolAddress?: string; liquidity?: string }> {
    // TODO: Implement actual Uniswap price fetching
    throw new Error('Uniswap price fetching not yet implemented')
  }
}

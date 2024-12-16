import { Token, PriceData } from '../interfaces/IPriceProvider.js'
import { IPriceProvider } from '../interfaces/IPriceProvider.js'

export const mockToken = (
  chainId: number = 1,
  address: string = '0x1234',
  decimals: number = 18,
  symbol: string = 'TEST'
): Token => ({
  chainId,
  address,
  decimals,
  symbol,
})

export const mockPriceData = (
  price: string = '1.0',
  source: string = 'test',
  timestamp: number = Date.now()
): PriceData => ({
  price,
  source,
  timestamp,
})

export class MockPriceProvider implements IPriceProvider {
  private mockPrice: PriceData
  private shouldSupport: boolean
  private shouldThrow: boolean

  constructor(
    mockPrice: PriceData = mockPriceData(),
    shouldSupport: boolean = true,
    shouldThrow: boolean = false
  ) {
    this.mockPrice = mockPrice
    this.shouldSupport = shouldSupport
    this.shouldThrow = shouldThrow
  }

  async getPrice(): Promise<PriceData> {
    if (this.shouldThrow) {
      throw new Error('Mock provider error')
    }
    return this.mockPrice
  }

  async supportsPair(): Promise<boolean> {
    if (this.shouldThrow) {
      throw new Error('Mock provider error')
    }
    return this.shouldSupport
  }
}

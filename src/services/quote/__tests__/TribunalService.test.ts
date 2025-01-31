import { TribunalService } from '../TribunalService'
import { config } from 'dotenv'

// Load environment variables from .env
config()

// Set up RPC URLs for tests if not already set
process.env.ETHEREUM_RPC_URL =
  process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'
process.env.OPTIMISM_RPC_URL =
  process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com'
process.env.BASE_RPC_URL =
  process.env.BASE_RPC_URL || 'https://base.llamarpc.com'

describe('TribunalService', () => {
  let tribunalService: TribunalService

  beforeEach(() => {
    tribunalService = new TribunalService()
  })

  describe('verifyMandateHash', () => {
    it('should correctly calculate and verify mandate hash', async () => {
      // Test values for Optimism (chainId 10)
      const mandate = {
        recipient: '0x1234567890123456789012345678901234567890',
        expires: BigInt('1735686000'), // Jan 1, 2025
        token: '0x4200000000000000000000000000000000000006', // WETH on Optimism
        minimumAmount: BigInt('1000000000000000000'), // 1 ETH
        baselinePriorityFee: BigInt('1000000000'), // 1 gwei
        scalingFactor: BigInt('1000000000000000000'), // 1.0
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }

      const chainId = 10
      const result = await tribunalService.verifyMandateHash(mandate, chainId)

      // Assertions
      expect(result.onChainHash).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.localHash).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.match).toBe(true)
    })
  })
})

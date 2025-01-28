import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from 'react-query'
import { useState, useRef, useEffect } from 'react'

const queryClient = new QueryClient()

interface HealthStatus {
  status: string
  timestamp: string
}

interface LockParameters {
  allocatorId: string
  resetPeriod: number
  isMultichain: boolean
}

interface QuoteContext {
  slippageBips?: number
  recipient?: string
  baselinePriorityFee?: string
  scalingFactor?: string
  expires?: string
}

interface QuoteRequest {
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
  sponsor?: string
  duration?: number
  lockParameters?: LockParameters
  context?: QuoteContext
}

interface Mandate {
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

interface QuoteData {
  arbiter: string
  tribunal: string
  sponsor: string
  nonce: string | null
  expires: string
  id: string
  amount: string
  maximumAmount: string
  dispensation: string
  mandate: Mandate
}

interface QuoteResponse extends QuoteRequest {
  arbiterConfiguration: {
    data: QuoteData
    witnessHash: string
  }
  dispensation: string
  dispensationUSD: string
  spotOutputAmount: string
  quoteOutputAmount: string
  deltaAmount: string
}

// Initial timestamp from the provided time
const INITIAL_TIME = '2024-12-17T13:15:52-08:00'

function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  return `${datePart} ${timePart}`
}

function QuoteForm() {
  const [formData, setFormData] = useState<QuoteRequest>({
    inputTokenChainId: 0,
    inputTokenAddress: '',
    inputTokenAmount: '',
    outputTokenChainId: 0,
    outputTokenAddress: '',
    sponsor: '0x0000000000000000000000000000000000000000',
    duration: 3600,
    lockParameters: {
      allocatorId: '0',
      resetPeriod: 0,
      isMultichain: false,
    },
    context: {
      slippageBips: 30,
    },
  })

  const quoteMutation = useMutation<QuoteResponse, Error, QuoteRequest>(
    async data => {
      const response = await fetch('/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to get quote')
      }
      const result = await response.json()
      console.log('Quote Result:', result)
      return result
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    quoteMutation.mutate(formData)
  }

  const isFormValid = () => {
    return (
      formData.inputTokenChainId > 0 &&
      formData.inputTokenAddress.length > 0 &&
      formData.inputTokenAmount.length > 0 &&
      formData.outputTokenChainId > 0 &&
      formData.outputTokenAddress.length > 0
    )
  }

  return (
    <div className="w-full max-w-7xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Input Chain ID
            </label>
            <input
              type="number"
              value={formData.inputTokenChainId || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  inputTokenChainId: parseInt(e.target.value) || 0,
                })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Input Token Address
            </label>
            <input
              type="text"
              value={formData.inputTokenAddress}
              onChange={e =>
                setFormData({ ...formData, inputTokenAddress: e.target.value })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Input Amount
          </label>
          <input
            type="text"
            value={formData.inputTokenAmount}
            onChange={e =>
              setFormData({ ...formData, inputTokenAmount: e.target.value })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Output Chain ID
            </label>
            <input
              type="number"
              value={formData.outputTokenChainId || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  outputTokenChainId: parseInt(e.target.value) || 0,
                })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Output Token Address
            </label>
            <input
              type="text"
              value={formData.outputTokenAddress}
              onChange={e =>
                setFormData({ ...formData, outputTokenAddress: e.target.value })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sponsor Address
            </label>
            <input
              type="text"
              value={formData.sponsor}
              onChange={e =>
                setFormData({ ...formData, sponsor: e.target.value })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={e =>
                setFormData({
                  ...formData,
                  duration: parseInt(e.target.value) || 3600,
                })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Lock Parameters
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Allocator ID
              </label>
              <input
                type="text"
                value={formData.lockParameters?.allocatorId}
                onChange={e =>
                  setFormData({
                    ...formData,
                    lockParameters: {
                      ...formData.lockParameters!,
                      allocatorId: e.target.value,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reset Period
              </label>
              <input
                type="number"
                value={formData.lockParameters?.resetPeriod}
                onChange={e =>
                  setFormData({
                    ...formData,
                    lockParameters: {
                      ...formData.lockParameters!,
                      resetPeriod: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.lockParameters?.isMultichain}
                onChange={e =>
                  setFormData({
                    ...formData,
                    lockParameters: {
                      ...formData.lockParameters!,
                      isMultichain: e.target.checked,
                    },
                  })
                }
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-600">Is Multichain</span>
            </label>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Context</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Slippage (BIPS)
              </label>
              <input
                type="number"
                value={formData.context?.slippageBips}
                onChange={e =>
                  setFormData({
                    ...formData,
                    context: {
                      ...formData.context!,
                      slippageBips: parseInt(e.target.value) || 30,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Recipient
              </label>
              <input
                type="text"
                value={formData.context?.recipient}
                onChange={e =>
                  setFormData({
                    ...formData,
                    context: {
                      ...formData.context!,
                      recipient: e.target.value,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Baseline Priority Fee
              </label>
              <input
                type="text"
                value={formData.context?.baselinePriorityFee}
                onChange={e =>
                  setFormData({
                    ...formData,
                    context: {
                      ...formData.context!,
                      baselinePriorityFee: e.target.value,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Scaling Factor
              </label>
              <input
                type="text"
                value={formData.context?.scalingFactor}
                onChange={e =>
                  setFormData({
                    ...formData,
                    context: {
                      ...formData.context!,
                      scalingFactor: e.target.value,
                    },
                  })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700">
              Expires
            </label>
            <input
              type="text"
              value={formData.context?.expires}
              onChange={e =>
                setFormData({
                  ...formData,
                  context: {
                    ...formData.context!,
                    expires: e.target.value,
                  },
                })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            type="submit"
            disabled={!isFormValid() || quoteMutation.isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {quoteMutation.isLoading ? 'Getting Quote...' : 'Get Quote'}
          </button>

          {quoteMutation.isError && (
            <p className="text-red-500 text-sm">
              Error: {quoteMutation.error.message}
            </p>
          )}
        </div>
      </form>

      {quoteMutation.isSuccess && (
        <div className="mt-6 p-6 bg-gray-50 rounded-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Quote Result
          </h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Quote Details</h4>
              <div className="space-y-2">
                <div className="flex">
                  <span className="w-80 font-medium">Spot Output Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.spotOutputAmount}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Quote Output Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.quoteOutputAmount}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Delta Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.deltaAmount}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Dispensation:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.dispensation}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Dispensation USD:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.dispensationUSD}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Witness Hash:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.witnessHash}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Quote Data</h4>
              <div className="space-y-2">
                <div className="flex">
                  <span className="w-80 font-medium">Arbiter:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.arbiter}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Tribunal:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.tribunal}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Sponsor:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.sponsor}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Nonce:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.arbiterConfiguration.data.nonce ||
                      'N/A'}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Expires:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.arbiterConfiguration.data.expires}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">ID:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.id}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.arbiterConfiguration.data.amount}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Maximum Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.arbiterConfiguration.data.maximumAmount}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Dispensation:</span>
                  <span className="flex-1 font-mono text-sm">
                    {quoteMutation.data.arbiterConfiguration.data.dispensation}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Mandate</h4>
              <div className="space-y-2">
                <div className="flex">
                  <span className="w-80 font-medium">Chain ID:</span>
                  <span className="flex-1 font-mono text-sm">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .chainId
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Tribunal:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .tribunal
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Recipient:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .recipient
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Expires:</span>
                  <span className="flex-1 font-mono text-sm">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .expires
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Token:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.mandate.token}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Minimum Amount:</span>
                  <span className="flex-1 font-mono text-sm">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .minimumAmount
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">
                    Baseline Priority Fee:
                  </span>
                  <span className="flex-1 font-mono text-sm">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .baselinePriorityFee
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Scaling Factor:</span>
                  <span className="flex-1 font-mono text-sm">
                    {
                      quoteMutation.data.arbiterConfiguration.data.mandate
                        .scalingFactor
                    }
                  </span>
                </div>
                <div className="flex">
                  <span className="w-80 font-medium">Salt:</span>
                  <span className="flex-1 font-mono text-sm break-all">
                    {quoteMutation.data.arbiterConfiguration.data.mandate.salt}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HealthCheck() {
  const startTime = useRef(Date.now())
  const [currentTime, setCurrentTime] = useState(new Date(INITIAL_TIME))

  // Update the time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime.current) / 1000)
      const newTime = new Date(
        new Date(INITIAL_TIME).getTime() + elapsedSeconds * 1000
      )
      setCurrentTime(newTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const { data, isLoading, isError } = useQuery<HealthStatus>(
    'health',
    async () => {
      // In test environment, use a mock URL that will be intercepted
      const baseUrl =
        process.env.NODE_ENV === 'test'
          ? 'http://test'
          : import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/health`)
      if (!response.ok) {
        throw new Error('Health check failed')
      }

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        timestamp: formatDateTime(currentTime),
      }
    },
    {
      refetchInterval: 1000, // Poll every second
      retry: 0, // Don't retry on failure
    }
  )

  if (isLoading) return <div className="text-gray-600">Checking health...</div>
  if (isError)
    return (
      <div className="text-sm flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500"></span>
          <span className="font-medium text-red-600">Status: unhealthy</span>
        </div>
        <div className="text-gray-500">
          Last checked: {formatDateTime(currentTime)}
        </div>
      </div>
    )

  return (
    <div className="text-sm flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${data?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}
        ></span>
        <span className="font-medium">Status: {data?.status}</span>
      </div>
      <div className="text-gray-500">Last checked: {data?.timestamp}</div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-[100rem] mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-6">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Calibrator
                </h1>
                <p className="text-gray-600 mb-4">
                  Cross-chain token swap parameter calculation service
                </p>
                <HealthCheck />
              </div>
              <div className="mt-8">
                <QuoteForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App

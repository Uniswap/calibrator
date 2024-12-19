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

interface QuoteRequest {
  inputTokenChainId: number
  inputTokenAddress: string
  inputTokenAmount: string
  outputTokenChainId: number
  outputTokenAddress: string
}

interface QuoteResponse extends QuoteRequest {
  spotOutputAmount: string | null
  quoteOutputAmount: string | null
  deltaAmount: string | null
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
      return response.json()
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
    <div className="w-full max-w-lg">
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
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Quote Result
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Spot Output Amount:</span>{' '}
              {quoteMutation.data.spotOutputAmount || 'N/A'}
            </p>
            <p>
              <span className="font-medium">Quote Output Amount:</span>{' '}
              {quoteMutation.data.quoteOutputAmount || 'N/A'}
            </p>
            <p>
              <span className="font-medium">Delta Amount:</span>{' '}
              {quoteMutation.data.deltaAmount || 'N/A'}
            </p>
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
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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

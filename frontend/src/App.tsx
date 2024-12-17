import { QueryClient, QueryClientProvider, useQuery } from 'react-query'
import { useState, useRef, useEffect } from 'react'

const queryClient = new QueryClient()

interface HealthStatus {
  status: string
  timestamp: string
}

// Initial timestamp from the provided time
const INITIAL_TIME = '2024-12-17T13:13:47-08:00'

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
      const response = await fetch('/health')
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
  const [count, setCount] = useState(0)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Calibrator
                </h1>
                <p className="text-gray-600 mb-4">
                  Cross-chain token swap parameter calculation service
                </p>
                <button
                  onClick={() => setCount(count => count + 1)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  count is {count}
                </button>
                <div className="mt-6">
                  <HealthCheck />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App

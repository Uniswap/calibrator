import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query'
import { useState } from 'react'

const queryClient = new QueryClient()

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
                  onClick={() => setCount((count) => count + 1)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  count is {count}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App

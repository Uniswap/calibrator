# Calibrator Service

Cross-chain token swap parameter calculation service using The Compact protocol.

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Setup

1. Install dependencies:
```bash
pnpm install
cd frontend && pnpm install
cd ..
```

2. Start development server:
```bash
pnpm dev
```

This will start both the backend server on `http://localhost:3000` and the frontend development server. The frontend will proxy API requests to the backend automatically.

## Project Structure

- `/src` - Backend TypeScript code
- `/frontend` - React frontend application
- `/dist` - Compiled backend code and frontend static files

## Available Endpoints

- `GET /health` - Service health check
- More endpoints coming soon...

## Development

- `pnpm run build` - Build both backend and frontend
- `pnpm dev` - Start both backend and frontend development servers
- `pnpm test` - Run tests
- `pnpm run lint` - Run linter

## Architecture

See [Calibrator - Architectural Overview.md](./Calibrator%20-%20Architectural%20Overview.md) for detailed architecture documentation.

# Calibrator Service

Cross-chain token swap parameter calculation service using The Compact protocol.

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Setup

1. Install dependencies:

```bash
pnpm install
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

### Available Commands

- `pnpm run build` - Build both backend and frontend
- `pnpm dev` - Start both backend and frontend development servers
- `pnpm test` - Run all tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm type-check` - Run TypeScript type checking

### Code Quality Tools

The project uses several tools to ensure code quality:

- **ESLint**: Lints TypeScript/JavaScript code
- **Prettier**: Formats code consistently
- **TypeScript**: Provides static type checking
- **Husky**: Runs checks on git commits
- **lint-staged**: Runs linters on staged files

### Pre-commit Hooks

The following checks run automatically before each commit:

1. Type checking
2. Tests
3. Linting and formatting of staged files

To skip pre-commit hooks (not recommended), use `git commit -n`

## Architecture

See [Calibrator - Architectural Overview.md](./Calibrator%20-%20Architectural%20Overview.md) for detailed architecture documentation.

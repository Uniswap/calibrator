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

2. Set up environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file and replace the placeholder values:

- `COINGECKO_API_KEY`: Your CoinGecko API key
- `UNISWAP_API_KEY`: Your Uniswap API key

3. Start development server:

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

## Development Architecture

### Project Structure

The project is set up as a monorepo using pnpm workspaces, consisting of two main packages:

- Root package: Contains the backend server (Fastify)
- Frontend package: Contains the React application

### Configuration Overview

#### Backend Configuration

- **TypeScript**: Uses ESM (ECMAScript Modules) with `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`
- **Testing**: Jest with ts-jest for TypeScript support
- Key files:
  - `tsconfig.json`: TypeScript configuration
  - `jest.config.cjs`: Jest test configuration (CommonJS format to avoid ESM issues)
  - `.eslintrc.json`: ESLint rules for backend

#### Frontend Configuration

- **TypeScript**: Uses ESM with Vite bundler
- **Testing**: Vitest with React Testing Library
- Key files:
  - `frontend/tsconfig.json`: TypeScript configuration for React
  - `frontend/vitest.config.ts`: Vitest test configuration
  - `frontend/src/setupTests.ts`: Test environment setup
  - `frontend/.eslintrc.json`: ESLint rules for React

### Server and Frontend Interplay

- Backend serves the frontend static files using `@fastify/static`
- Frontend is built into `frontend/dist` which is served by the backend
- Development uses concurrent processes:
  - Backend: Running on port 3000 with hot reload
  - Frontend: Vite dev server with HMR

### Pre-commit Hooks

The project uses Husky with lint-staged for pre-commit checks:

1. **Type Checking**: Runs `tsc --noEmit` to verify types
2. **Tests**: Executes both backend (Jest) and frontend (Vitest) tests
3. **Linting**: ESLint with automatic fixing
4. **Formatting**: Prettier with automatic formatting

### Development Workflow

The goal is to make targeted, specific changes while maintaining code quality and commit them to git (which is already initialized and configured to run pre-commit hooks):

1. **Make Focused Changes**

   - Make specific, targeted additions or modifications
   - Add related tests that cover the changes
   - Avoid modifying configuration unless absolutely necessary

2. **Pre-commit Process**

   - Stage your changes
   - Pre-commit hooks will automatically:
     - Check types
     - Run tests
     - Fix linting issues
     - Format code
   - Address any issues that arise
   - Make absolute best efforts to solve issues within the existing configuration

3. **Configuration Changes**
   - Only modify configuration as a last resort
   - Document why the change was necessary
   - Ensure changes don't break existing functionality

Remember: The configuration is designed to maintain code quality and consistency. If you encounter issues, first try to adapt your code to meet the existing standards before considering configuration changes.

## Architecture

See [Calibrator - Architectural Overview.md](./Calibrator%20-%20Architectural%20Overview.md) for detailed architecture documentation.

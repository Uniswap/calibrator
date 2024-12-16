# Calibrator Service Architecture Overview

## System Purpose
Calibrator is a TypeScript/Node.js API service using Fastify that facilitates cross-chain token swaps using The Compact protocol. It acts as a price discovery and parameter calculation service, helping users prepare valid Compact messages for cross-chain token exchanges.

## Core Functions
1. Price Discovery and Validation
   - Retrieve spot prices from multiple sources (Uniswap API, CoinGecko)
   - Compare and validate prices across sources
   - Select optimal price for user benefit

2. Arbiter Selection
   - Maintain configuration of valid arbiters
   - Select appropriate arbiter based on chains involved
   - Verify arbiter availability and capability

3. Fee Calculation
   - Calculate message relay fees (dispensation)
   - Estimate gas costs for settlement
   - Determine total transaction costs

4. Parameter Calculation
   - Calculate minimum output based on user slippage tolerance
   - Generate complete Compact message parameters
   - Validate all parameters meet protocol requirements

## Technical Architecture

### Frontend Application
- Framework: React with TypeScript
- Build Tool: Vite
- Key Features:
  - Interactive UI for token swap parameter configuration
  - Real-time price and fee displays
  - Chain and token selection interfaces
  - Transaction parameter visualization
- Components:
  - Styling: TailwindCSS for modern, responsive design
  - State Management: React Query for API integration
  - Development: Hot module replacement (HMR)

### API Layer
- Framework: Fastify
- Endpoints:
  - GET /health - Service health check
  - POST /quote - Main endpoint for parameter calculation
  - GET /arbiters - View supported arbiters
  - GET /chains - View supported chains
- Static File Serving:
  - Serves compiled React application
  - Handles SPA routing

### Core Services

#### Price Service
- Integrates with Uniswap V3 API
- Integrates with CoinGecko API
- Implements price comparison and selection logic
- Handles caching of recent price data

#### Arbiter Service
- Manages arbiter configuration
- Implements arbiter selection logic
- Monitors arbiter health/status

#### Fee Calculator Service
- Calculates message relay fees
- Estimates gas costs
- Maintains gas price oracle connections

#### Parameter Service
- Calculates minimum output
- Generates Compact message parameters
- Validates parameter bounds

### Infrastructure Components
- TypeScript/Node.js runtime
- Configuration management
- Logging and monitoring
- Error handling and reporting
- Health checks and metrics

## Implementation Checklist

### Research & Documentation Tasks
- [ ] Review complete Compact protocol documentation
- [ ] Document specific requirements for arbiter selection
- [ ] Define price deviation tolerance thresholds
- [ ] Document gas estimation methodology
- [ ] Define API response formats and error codes

### Infrastructure Setup
- [x] Set up TypeScript project with proper configuration
- [x] Configure Fastify server with basic middleware
- [x] Set up logging infrastructure
- [ ] Configure monitoring and alerting
- [ ] Set up CI/CD pipeline

### Frontend Development
- [x] Set up React application with Vite
- [x] Configure TailwindCSS for styling
- [x] Set up development environment with HMR
- [ ] Implement token selection interface
- [ ] Create price display components
- [ ] Build transaction parameter form
- [ ] Add real-time validation
- [ ] Implement responsive design
- [ ] Add error handling and user feedback

### External Integration Tasks
- [ ] Implement Uniswap V3 API client
- [ ] Implement CoinGecko API client
- [ ] Set up price comparison logic
- [ ] Implement gas price oracle integration
- [ ] Create mock integrations for testing

### Core Service Implementation
- [ ] Implement Price Service
- [ ] Price fetching logic
- [ ] Price comparison algorithm
- [ ] Caching layer
- [ ] Implement Arbiter Service
- [ ] Configuration management
- [ ] Selection logic
- [ ] Health checking
- [ ] Implement Fee Calculator
- [ ] Gas estimation logic
- [ ] Dispensation calculation
- [ ] Implement Parameter Service
- [ ] Minimum output calculation
- [ ] Message parameter generation
- [ ] Validation logic

### API Implementation
- [x] Implement health endpoint
- [ ] Implement main quote endpoint
- [ ] Implement support endpoints
- [ ] Add request validation
- [ ] Add rate limiting
- [ ] Add authentication/authorization

### Testing
- [ ] Write unit tests for all services
- [ ] Write integration tests
- [ ] Set up end-to-end testing
- [ ] Create performance tests
- [ ] Document testing strategy

### Documentation
- [ ] Create API documentation
- [x] Write deployment guide
- [ ] Create monitoring guide
- [ ] Document troubleshooting procedures

### Outstanding Questions
1. What are the specific criteria for arbiter selection?
2. What is the acceptable price deviation threshold between sources?
3. How should gas estimation account for different network conditions?
4. What are the required response times for the API?
5. What monitoring metrics should be tracked?

## Next Steps
1. Prioritize implementation checklist
2. Create detailed technical specifications for each component
3. Begin implementation of core services in TypeScript with Node.js and Fastify (small steps at a time with frequent commits and writing tests as we go)
4. Start building the frontend interface components in parallel with the API development

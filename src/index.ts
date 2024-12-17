import { build } from './app.js'
import { Logger } from './utils/logger.js'

// Load environment variables
const { config } = await import('dotenv')
config()

const logger = new Logger('Server')

async function main() {
  try {
    const app = await build()
    await app.listen({ port: 3000, host: '0.0.0.0' })
    logger.info('Server listening on port 3000')
  } catch (err) {
    logger.error(`Error starting server: ${err}`)
    process.exit(1)
  }
}

main()

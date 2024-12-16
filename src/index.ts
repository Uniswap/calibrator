import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthRoutes } from './routes/health';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register plugins
server.register(cors);

// Register API routes first
server.register(healthRoutes, { prefix: '/health' });

// Then serve static files from the React app
server.register(fastifyStatic, {
  root: path.join(__dirname, '../dist/public'),
  prefix: '/',
});

// Finally, add the catch-all route for the SPA
server.setNotFoundHandler(async (request, reply) => {
  return reply.sendFile('index.html');
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    server.log.info(`Server listening on ${server.server.address()}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

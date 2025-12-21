import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { healthHandler } from './routes/health';
import { emceesRoutes } from './routes/emcees';
import { divisionsRoutes } from './routes/divisions';
import { adminRoutes } from './routes/admin';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // In production, specify allowed origins
  });

  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'FlipStats API',
        description: 'REST API for FlipTop Emcees data',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'emcees', description: 'Emcees data endpoints' },
        { name: 'divisions', description: 'Divisions endpoints' },
        { name: 'admin', description: 'Admin endpoints (protected)' },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register routes
  fastify.get('/health', healthHandler);
  await fastify.register(emceesRoutes);
  await fastify.register(divisionsRoutes);
  await fastify.register(adminRoutes);

  // Root route
  fastify.get('/', async () => {
    return {
      name: 'FlipStats API',
      version: '1.0.0',
      description: 'REST API for FlipTop Emcees data',
      documentation: '/docs',
      endpoints: {
        health: '/health',
        emcees: '/v1/emcees',
        divisions: '/v1/divisions',
      },
    };
  });

  return fastify;
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ingestEmcees } from '../ingest/emcees';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  throw new Error('ADMIN_TOKEN environment variable is required');
}

// Admin authentication hook
async function verifyAdminToken(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-admin-token'];

  if (!token || token !== ADMIN_TOKEN) {
    reply.status(401).send({ error: 'Unauthorized - Invalid admin token' });
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  // POST /admin/refresh-emcees - Trigger emcees ingestion
  fastify.post(
    '/admin/refresh-emcees',
    {
      onRequest: verifyAdminToken,
      schema: {
        description: 'Trigger emcees data ingestion (admin only)',
        tags: ['admin'],
        headers: {
          type: 'object',
          properties: {
            'x-admin-token': { type: 'string' },
          },
          required: ['x-admin-token'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              result: {
                type: 'object',
                properties: {
                  found: { type: 'integer' },
                  updated: { type: 'integer' },
                  failed: { type: 'integer' },
                  runId: { type: 'integer' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      fastify.log.info('Admin triggered emcees ingestion');

      try {
        const result = await ingestEmcees();

        if (result.success) {
          reply.send({
            success: true,
            message: 'Emcees ingestion completed successfully',
            result: {
              found: result.found,
              updated: result.updated,
              failed: result.failed,
              runId: result.runId,
            },
          });
        } else {
          reply.status(500).send({
            success: false,
            message: 'Emcees ingestion failed',
            error: result.error,
          });
        }
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({
          success: false,
          message: 'Unexpected error during ingestion',
          error: String(error),
        });
      }
    }
  );
}

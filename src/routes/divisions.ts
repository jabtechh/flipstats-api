import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDivisions } from '../db/queries/emcees';

export async function divisionsRoutes(fastify: FastifyInstance) {
  // GET /v1/divisions - Get all unique divisions
  fastify.get(
    '/v1/divisions',
    {
      schema: {
        description: 'Get list of all divisions',
        tags: ['divisions'],
        response: {
          200: {
            type: 'object',
            properties: {
              divisions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const divisions = await getDivisions();
        reply.send({ divisions });
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

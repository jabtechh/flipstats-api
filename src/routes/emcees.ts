import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEmcees, getEmceeBySlug } from '../db/queries/emcees';

// Validation schemas
const emceesListSchema = z.object({
  division: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'year_joined', 'created_at']).default('name'),
});

const emceeSlugSchema = z.object({
  slug: z.string().min(1),
});

export async function emceesRoutes(fastify: FastifyInstance) {
  // GET /v1/emcees - List emcees with filtering and pagination
  fastify.get(
    '/v1/emcees',
    {
      schema: {
        description: 'Get paginated list of emcees',
        tags: ['emcees'],
        querystring: {
          type: 'object',
          properties: {
            division: { type: 'string', description: 'Filter by division' },
            search: { type: 'string', description: 'Search by name' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort: { type: 'string', enum: ['name', 'year_joined', 'created_at'], default: 'name' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = emceesListSchema.parse(request.query);
        const result = await getEmcees(params);
        reply.send(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400).send({
            error: 'Validation error',
            details: error.errors,
          });
        } else {
          fastify.log.error(error);
          reply.status(500).send({ error: 'Internal server error' });
        }
      }
    }
  );

  // GET /v1/emcees/:slug - Get single emcee by slug
  fastify.get(
    '/v1/emcees/:slug',
    {
      schema: {
        description: 'Get a single emcee by slug',
        tags: ['emcees'],
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
          required: ['slug'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              slug: { type: 'string' },
              name: { type: 'string' },
              division: { type: ['string', 'null'] },
              hometown: { type: ['string', 'null'] },
              reppin: { type: ['string', 'null'] },
              year_joined: { type: ['integer', 'null'] },
              bio: { type: ['string', 'null'] },
              source_url: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { slug } = emceeSlugSchema.parse(request.params);
        const emcee = await getEmceeBySlug(slug);

        if (!emcee) {
          reply.status(404).send({ error: 'Emcee not found' });
          return;
        }

        reply.send(emcee);
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400).send({
            error: 'Validation error',
            details: error.errors,
          });
        } else {
          fastify.log.error(error);
          reply.status(500).send({ error: 'Internal server error' });
        }
      }
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEmcees, getEmceeBySlug, getStats } from '../db/queries/emcees';
import { getYearlyStats } from '../db/queries/yearlyStats';

// Validation schemas
const emceesListSchema = z.object({
  division: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['views_desc', 'views_asc', 'name_asc', 'name_desc', 'created_at']).default('views_desc'),
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
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            sort: { type: 'string', enum: ['views_desc', 'views_asc', 'name_asc', 'name_desc', 'created_at'], default: 'views_desc' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              lastUpdated: { type: 'string' },
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
              image_url: { type: ['string', 'null'] },
              source_url: { type: 'string' },
              total_views: { type: ['integer', 'string', 'null'] },
              last_updated: { type: ['string', 'null'] },
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

  // GET /v1/stats - Get aggregate statistics
  fastify.get(
    '/v1/stats',
    {
      schema: {
        description: 'Get aggregate view statistics',
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              totalEmcees: { type: 'integer' },
              totalViews: { type: 'integer' },
              topDivision: {
                type: ['object', 'null'],
                properties: {
                  name: { type: 'string' },
                  views: { type: 'integer' },
                },
              },
              lastUpdated: { type: ['string', 'null'] },
              viewsByDivision: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    division: { type: 'string' },
                    views: { type: 'integer' },
                    emceeCount: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getStats();
        reply.send(stats);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // GET /v1/stats/yearly - Get views by year for trend chart
  fastify.get(
    '/v1/stats/yearly',
    {
      schema: {
        description: 'Get yearly view statistics for trend chart',
        tags: ['stats'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                year: { type: 'integer' },
                totalViews: { type: 'integer' },
                videoCount: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const yearlyStats = await getYearlyStats();
        reply.send(yearlyStats);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

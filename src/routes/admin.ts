import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ingestEmcees } from '../ingest/emcees';
import { getAllEmceeNames, updateEmceeViews, resetAllViews } from '../db/queries/emcees';
import { pool } from '../db/pool';

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

  // POST /admin/refresh-youtube-views - Trigger YouTube views ingestion
  fastify.post(
    '/admin/refresh-youtube-views',
    {
      onRequest: verifyAdminToken,
      schema: {
        description: 'Trigger YouTube views data ingestion (admin only)',
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
                  videosProcessed: { type: 'integer' },
                  emceesUpdated: { type: 'integer' },
                  totalViewsAttributed: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      fastify.log.info('Admin triggered YouTube views ingestion');

      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Step 1: Get all emcees from database
        const dbEmcees = await getAllEmceeNames();
        fastify.log.info({ count: dbEmcees.length }, 'Loaded emcees from database');

        // Step 2: Fetch REAL videos from YouTube API
        const { fetchFlipTopVideosFromAPI, calculateEmceeViews, calculateYearlyStats } = await import('../ingest/youtube');
        const videos = await fetchFlipTopVideosFromAPI();
        fastify.log.info({ videoCount: videos.length }, 'Fetched videos from YouTube API');

        // Step 3: Calculate views per emcee
        const viewsMap = calculateEmceeViews(videos, dbEmcees);
        fastify.log.info({ emceesWithViews: viewsMap.size }, 'Calculated views per emcee');

        // Step 4: Calculate yearly stats
        const yearlyStats = calculateYearlyStats(videos);
        fastify.log.info({ yearsTracked: yearlyStats.size }, 'Calculated yearly stats');

        // Step 5: Reset all views to 0 (fresh calculation)
        await resetAllViews(client);

        // Step 6: Update each emcee's total views
        let updated = 0;
        let totalViews = 0;
        
        for (const [slug, views] of viewsMap.entries()) {
          await updateEmceeViews(slug, views, client);
          updated++;
          totalViews += views;
        }

        // Step 7: Save yearly stats
        const { clearYearlyStats, upsertYearlyStats } = await import('../db/queries/yearlyStats');
        await clearYearlyStats();
        for (const [year, stats] of yearlyStats.entries()) {
          await upsertYearlyStats(year, stats.views, stats.count);
        }

        await client.query('COMMIT');

        reply.send({
          success: true,
          message: 'YouTube views ingestion completed successfully',
          result: {
            emceesProcessed: dbEmcees.length,
            emceesUpdated: updated,
            totalViewsAttributed: totalViews,
            videosProcessed: videos.length,
            yearsTracked: yearlyStats.size,
          },
        });
      } catch (error) {
        await client.query('ROLLBACK');
        fastify.log.error(error, 'YouTube views ingestion failed');
        reply.status(500).send({
          success: false,
          message: 'YouTube views ingestion failed',
          error: String(error),
        });
      } finally {
        client.release();
      }
    }
  );
}

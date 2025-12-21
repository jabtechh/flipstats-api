import { FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseHealth } from '../db/pool';
import { getEmceesCount } from '../db/queries/emcees';

export async function healthHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const dbHealthy = await checkDatabaseHealth();
  
  let emceesCount = 0;
  if (dbHealthy) {
    try {
      emceesCount = await getEmceesCount();
    } catch (error) {
      // Ignore count errors for health check
    }
  }

  const statusCode = dbHealthy ? 200 : 503;

  reply.status(statusCode).send({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    emcees_count: emceesCount,
  });
}

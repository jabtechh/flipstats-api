import { Pool, PoolClient } from 'pg';
import pino from 'pino';

const logger = pino({ name: 'db' });

// Database configuration from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const DB_URL = DATABASE_URL;

function shouldUseSsl(): boolean {
  if (process.env.PGSSLMODE === 'require') {
    return true;
  }

  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  return DB_URL.includes('sslmode=require');
}

// Create a connection pool
export const pool = new Pool({
  connectionString: DB_URL,
  ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pool error handler
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle database client');
});

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

// Close the pool (useful for graceful shutdown)
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

import { PoolClient } from 'pg';
import { pool } from '../pool';

// Types
export interface IngestRun {
  id: number;
  type: string;
  started_at: Date;
  finished_at: Date | null;
  found_count: number;
  updated_count: number;
  failed_count: number;
  status: 'SUCCESS' | 'FAIL';
  error_summary: string | null;
}

export interface IngestRunInput {
  type: string;
  status: 'SUCCESS' | 'FAIL';
  found_count?: number;
  updated_count?: number;
  failed_count?: number;
  error_summary?: string | null;
}

/**
 * Create a new ingest run
 */
export async function createIngestRun(
  type: string,
  client?: PoolClient
): Promise<IngestRun> {
  const db = client || pool;

  const query = `
    INSERT INTO ingest_runs (type, status)
    VALUES ($1, 'FAIL')
    RETURNING *
  `;

  const result = await db.query<IngestRun>(query, [type]);
  return result.rows[0];
}

/**
 * Update an ingest run with results
 */
export async function updateIngestRun(
  id: number,
  data: IngestRunInput,
  client?: PoolClient
): Promise<IngestRun> {
  const db = client || pool;

  const query = `
    UPDATE ingest_runs
    SET
      status = $2,
      finished_at = now(),
      found_count = $3,
      updated_count = $4,
      failed_count = $5,
      error_summary = $6
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    id,
    data.status,
    data.found_count || 0,
    data.updated_count || 0,
    data.failed_count || 0,
    data.error_summary || null,
  ];

  const result = await db.query<IngestRun>(query, values);
  return result.rows[0];
}

/**
 * Get recent ingest runs
 */
export async function getRecentIngestRuns(
  type?: string,
  limit = 10
): Promise<IngestRun[]> {
  const query = type
    ? 'SELECT * FROM ingest_runs WHERE type = $1 ORDER BY started_at DESC LIMIT $2'
    : 'SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT $1';

  const values = type ? [type, limit] : [limit];
  const result = await pool.query<IngestRun>(query, values);
  return result.rows;
}

import { PoolClient } from 'pg';
import { pool } from '../pool';

// Types
export interface Emcee {
  id: number;
  slug: string;
  name: string;
  division: string | null;
  hometown: string | null;
  reppin: string | null;
  year_joined: number | null;
  bio: string | null;
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmceeInput {
  slug: string;
  name: string;
  division?: string | null;
  hometown?: string | null;
  reppin?: string | null;
  year_joined?: number | null;
  bio?: string | null;
  source_url: string;
}

export interface EmceesListParams {
  division?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'name' | 'year_joined' | 'created_at';
}

export interface PaginatedEmcees {
  data: Emcee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Upsert an emcee (insert or update if slug exists)
 */
export async function upsertEmcee(
  emcee: EmceeInput,
  client?: PoolClient
): Promise<Emcee> {
  const db = client || pool;

  const query = `
    INSERT INTO emcees (
      slug, name, division, hometown, reppin, year_joined, bio, source_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      division = EXCLUDED.division,
      hometown = EXCLUDED.hometown,
      reppin = EXCLUDED.reppin,
      year_joined = EXCLUDED.year_joined,
      bio = EXCLUDED.bio,
      source_url = EXCLUDED.source_url,
      updated_at = now()
    RETURNING *
  `;

  const values = [
    emcee.slug,
    emcee.name,
    emcee.division || null,
    emcee.hometown || null,
    emcee.reppin || null,
    emcee.year_joined || null,
    emcee.bio || null,
    emcee.source_url,
  ];

  const result = await db.query<Emcee>(query, values);
  return result.rows[0];
}

/**
 * Get a single emcee by slug
 */
export async function getEmceeBySlug(slug: string): Promise<Emcee | null> {
  const query = 'SELECT * FROM emcees WHERE slug = $1';
  const result = await pool.query<Emcee>(query, [slug]);
  return result.rows[0] || null;
}

/**
 * Get paginated list of emcees with filters
 */
export async function getEmcees(
  params: EmceesListParams
): Promise<PaginatedEmcees> {
  const {
    division,
    search,
    page = 1,
    limit = 20,
    sort = 'name',
  } = params;

  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  // Build WHERE clause
  if (division) {
    conditions.push(`division = $${paramIndex}`);
    values.push(division);
    paramIndex++;
  }

  if (search) {
    conditions.push(`name ILIKE $${paramIndex}`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate and build ORDER BY clause
  const validSorts = ['name', 'year_joined', 'created_at'];
  const orderBy = validSorts.includes(sort) ? sort : 'name';
  const orderDirection = orderBy === 'name' ? 'ASC' : 'DESC';

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM emcees ${whereClause}`;
  const countResult = await pool.query<{ count: string }>(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated data
  const dataQuery = `
    SELECT * FROM emcees
    ${whereClause}
    ORDER BY ${orderBy} ${orderDirection}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  values.push(limit, offset);

  const dataResult = await pool.query<Emcee>(dataQuery, values);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get all unique divisions
 */
export async function getDivisions(): Promise<string[]> {
  const query = `
    SELECT DISTINCT division
    FROM emcees
    WHERE division IS NOT NULL
    ORDER BY division
  `;
  const result = await pool.query<{ division: string }>(query);
  return result.rows.map((row) => row.division);
}

/**
 * Get count of emcees
 */
export async function getEmceesCount(): Promise<number> {
  const query = 'SELECT COUNT(*) as count FROM emcees';
  const result = await pool.query<{ count: string }>(query);
  return parseInt(result.rows[0].count, 10);
}

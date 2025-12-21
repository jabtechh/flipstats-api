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
  image_url: string | null;
  source_url: string;
  total_views: number;
  last_updated: Date | null;
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
  image_url?: string | null;
  source_url: string;
}

export interface EmceesListParams {
  division?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'views_desc' | 'views_asc' | 'name_asc' | 'name_desc' | 'created_at';
}

export interface PaginatedEmcees {
  items: Emcee[];
  page: number;
  limit: number;
  total: number;
  lastUpdated?: string;
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
      slug, name, division, hometown, reppin, year_joined, bio, image_url, source_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      division = EXCLUDED.division,
      hometown = EXCLUDED.hometown,
      reppin = EXCLUDED.reppin,
      year_joined = EXCLUDED.year_joined,
      bio = EXCLUDED.bio,
      image_url = COALESCE(EXCLUDED.image_url, emcees.image_url),
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
    emcee.image_url || null,
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
    limit = 50,
    sort = 'views_desc',
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

  // Build ORDER BY clause
  let orderBy = '';
  switch (sort) {
    case 'views_desc':
      orderBy = 'total_views DESC, name ASC';
      break;
    case 'views_asc':
      orderBy = 'total_views ASC, name ASC';
      break;
    case 'name_asc':
      orderBy = 'name ASC';
      break;
    case 'name_desc':
      orderBy = 'name DESC';
      break;
    case 'created_at':
      orderBy = 'created_at DESC';
      break;
    default:
      orderBy = 'total_views DESC, name ASC';
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM emcees ${whereClause}`;
  const countResult = await pool.query<{ count: string }>(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get most recent lastUpdated timestamp
  const lastUpdatedQuery = `SELECT MAX(last_updated) as last_updated FROM emcees ${whereClause}`;
  const lastUpdatedResult = await pool.query<{ last_updated: Date | null }>(
    lastUpdatedQuery,
    values
  );
  const lastUpdated = lastUpdatedResult.rows[0]?.last_updated;

  // Get paginated data (exclude bio for list view)
  const dataQuery = `
    SELECT id, slug, name, division, hometown, reppin, year_joined, image_url, source_url, 
           total_views, last_updated, created_at, updated_at 
    FROM emcees
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  values.push(limit, offset);

  const dataResult = await pool.query<Emcee>(dataQuery, values);

  return {
    items: dataResult.rows,
    page,
    limit,
    total,
    lastUpdated: lastUpdated ? lastUpdated.toISOString() : undefined,
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

/**
 * Get aggregate stats for dashboard
 */
export async function getStats(): Promise<{
  totalEmcees: number;
  totalViews: number;
  topDivision: { name: string; views: number } | null;
  lastUpdated: string | null;
  viewsByDivision: Array<{ division: string; views: number; emceeCount: number }>;
}> {
  // Total emcees and views
  const totalsQuery = `
    SELECT COUNT(*) as emcee_count, COALESCE(SUM(total_views), 0) as total_views
    FROM emcees
  `;
  const totalsResult = await pool.query<{ emcee_count: string; total_views: string }>(totalsQuery);
  
  // Views by division
  const divisionQuery = `
    SELECT 
      COALESCE(division, 'Unknown') as division,
      COALESCE(SUM(total_views), 0) as views,
      COUNT(*) as emcee_count
    FROM emcees
    GROUP BY division
    ORDER BY views DESC
  `;
  const divisionResult = await pool.query<{ division: string; views: string; emcee_count: string }>(divisionQuery);
  
  // Last updated
  const lastUpdatedQuery = `SELECT MAX(last_updated) as last_updated FROM emcees`;
  const lastUpdatedResult = await pool.query<{ last_updated: Date | null }>(lastUpdatedQuery);
  
  const viewsByDivision = divisionResult.rows.map(row => ({
    division: row.division,
    views: parseInt(row.views, 10),
    emceeCount: parseInt(row.emcee_count, 10),
  }));
  
  const topDivision = viewsByDivision.length > 0 
    ? { name: viewsByDivision[0].division, views: viewsByDivision[0].views }
    : null;
  
  return {
    totalEmcees: parseInt(totalsResult.rows[0].emcee_count, 10),
    totalViews: parseInt(totalsResult.rows[0].total_views, 10),
    topDivision,
    lastUpdated: lastUpdatedResult.rows[0]?.last_updated?.toISOString() || null,
    viewsByDivision,
  };
}

/**
 * Update total views for an emcee
 */
export async function updateEmceeViews(
  slug: string,
  totalViews: number,
  client?: PoolClient
): Promise<void> {
  const db = client || pool;
  const query = `
    UPDATE emcees 
    SET total_views = $1, last_updated = now()
    WHERE slug = $2
  `;
  await db.query(query, [totalViews, slug]);
}

/**
 * Reset all views to 0 (for fresh ingestion)
 */
export async function resetAllViews(client?: PoolClient): Promise<void> {
  const db = client || pool;
  const query = `UPDATE emcees SET total_views = 0, last_updated = now()`;
  await db.query(query);
}

/**
 * Get all emcee names for matching
 */
export async function getAllEmceeNames(): Promise<Array<{ slug: string; name: string }>> {
  const query = `SELECT slug, name FROM emcees ORDER BY name`;
  const result = await pool.query<{ slug: string; name: string }>(query);
  return result.rows;
}

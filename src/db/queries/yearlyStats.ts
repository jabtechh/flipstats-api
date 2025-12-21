import { pool } from '../pool';

export interface YearlyStats {
  year: number;
  totalViews: number;
  videoCount: number;
}

/**
 * Upsert yearly stats
 */
export async function upsertYearlyStats(
  year: number,
  totalViews: number,
  videoCount: number
): Promise<void> {
  const query = `
    INSERT INTO yearly_stats (year, total_views, video_count)
    VALUES ($1, $2, $3)
    ON CONFLICT (year) DO UPDATE SET
      total_views = $2,
      video_count = $3,
      updated_at = now()
  `;
  await pool.query(query, [year, totalViews, videoCount]);
}

/**
 * Get all yearly stats for the chart
 */
export async function getYearlyStats(): Promise<YearlyStats[]> {
  const query = `
    SELECT year, total_views, video_count
    FROM yearly_stats
    ORDER BY year ASC
  `;
  const result = await pool.query<{ year: number; total_views: string; video_count: number }>(query);
  
  return result.rows.map(row => ({
    year: row.year,
    totalViews: parseInt(row.total_views, 10),
    videoCount: row.video_count,
  }));
}

/**
 * Clear all yearly stats (for fresh ingestion)
 */
export async function clearYearlyStats(): Promise<void> {
  await pool.query('DELETE FROM yearly_stats');
}

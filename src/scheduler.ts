import cron from 'node-cron';
import pino from 'pino';
import { fetchFlipTopVideosFromAPI, calculateEmceeViews, calculateYearlyStats } from './ingest/youtube';
import { getAllEmceeNames, updateEmceeViews, resetAllViews } from './db/queries/emcees';
import { clearYearlyStats, upsertYearlyStats } from './db/queries/yearlyStats';
import { pool } from './db/pool';

const logger = pino({ name: 'scheduler' });

// Schedule YouTube sync every 2 days at 3:00 AM
// Cron format: minute hour day-of-month month day-of-week
// "0 3 */2 * *" = At 03:00 every 2nd day
const YOUTUBE_SYNC_SCHEDULE = process.env.YOUTUBE_SYNC_SCHEDULE || '0 3 */2 * *';

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

export function startScheduler() {
  if (!process.env.YOUTUBE_API_KEY) {
    logger.warn('YOUTUBE_API_KEY not set - automatic sync disabled');
    return;
  }

  logger.info({ schedule: YOUTUBE_SYNC_SCHEDULE }, 'Starting YouTube sync scheduler (every 2 days at 3:00 AM)');

  scheduledTask = cron.schedule(YOUTUBE_SYNC_SCHEDULE, async () => {
    logger.info('Starting scheduled YouTube views sync...');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dbEmcees = await getAllEmceeNames();
      const videos = await fetchFlipTopVideosFromAPI();
      const viewsMap = calculateEmceeViews(videos, dbEmcees);
      const yearlyStats = calculateYearlyStats(videos);

      await resetAllViews(client);

      let emceesUpdated = 0;
      let totalViews = 0;
      for (const [slug, views] of viewsMap.entries()) {
        await updateEmceeViews(slug, views, client);
        emceesUpdated++;
        totalViews += views;
      }

      await clearYearlyStats();
      for (const [year, stats] of yearlyStats.entries()) {
        await upsertYearlyStats(year, stats.views, stats.count);
      }

      await client.query('COMMIT');

      logger.info({
        videosProcessed: videos.length,
        emceesUpdated,
        totalViews,
      }, 'Scheduled YouTube sync completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error: String(error) }, 'Scheduled YouTube sync threw an error');
    } finally {
      client.release();
    }
  }, {
    timezone: 'Asia/Manila', // FlipTop is based in the Philippines
  });

  logger.info('Scheduler started successfully');
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    logger.info('Scheduler stopped');
  }
}

export function getNextSyncTime(): Date | null {
  if (!scheduledTask) return null;
  
  // Calculate next run based on schedule (every 2 days at 3 AM Manila time)
  const now = new Date();
  const nextRun = new Date(now);
  
  // Set to 3 AM
  nextRun.setHours(3, 0, 0, 0);
  
  // If we're past 3 AM today, add days
  if (now.getHours() >= 3) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  // Adjust for every 2 days pattern
  const dayOfMonth = nextRun.getDate();
  if (dayOfMonth % 2 !== 1) {
    nextRun.setDate(dayOfMonth + 1);
  }
  
  return nextRun;
}

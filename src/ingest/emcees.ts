import * as cheerio from 'cheerio';
import pino from 'pino';
import { upsertEmcee, EmceeInput } from '../db/queries/emcees';
import { createIngestRun, updateIngestRun } from '../db/queries/ingestRuns';

const logger = pino({ name: 'ingest-emcees' });

// Configuration
const BASE_URL = 'https://www.fliptop.com.ph';
const EMCEES_URL = `${BASE_URL}/emcees`;
const SCRAPE_DELAY_MIN = parseInt(process.env.SCRAPE_DELAY_MIN || '500', 10);
const SCRAPE_DELAY_MAX = parseInt(process.env.SCRAPE_DELAY_MAX || '1200', 10);
const SCRAPE_MAX_RETRIES = parseInt(process.env.SCRAPE_MAX_RETRIES || '3', 10);

interface EmceeListItem {
  slug: string;
  name: string;
  profileUrl: string;
}

interface ScrapeResult {
  success: boolean;
  emcee?: EmceeInput;
  error?: string;
}

/**
 * Random delay between requests to be respectful to the server
 */
function randomDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * (SCRAPE_DELAY_MAX - SCRAPE_DELAY_MIN + 1)) + SCRAPE_DELAY_MIN;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Fetch HTML with retries and exponential backoff
 */
async function fetchWithRetry(url: string, retries = SCRAPE_MAX_RETRIES): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      logger.info({ url, attempt: attempt + 1 }, 'Fetching URL');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FlipStats-API-Bot/1.0 (Educational Project)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      logger.warn(
        { url, attempt: attempt + 1, error: String(error), isLastAttempt },
        'Fetch attempt failed'
      );

      if (isLastAttempt) {
        throw error;
      }

      // Exponential backoff
      const backoffDelay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error('All retry attempts exhausted');
}

/**
 * Extract slug from URL
 */
function extractSlug(url: string): string {
  const match = url.match(/\/emcees\/([^/]+)/);
  return match ? match[1] : '';
}

/**
 * Scrape the emcees directory page to get list of emcees
 */
async function scrapeEmceesDirectory(): Promise<EmceeListItem[]> {
  logger.info('Scraping emcees directory');
  
  const html = await fetchWithRetry(EMCEES_URL);
  const $ = cheerio.load(html);
  
  const emcees: EmceeListItem[] = [];

  // Parse the emcees list
  // Adjust selectors based on actual HTML structure
  $('.emcee-item, .emcee-card, a[href*="/emcees/"]').each((_, element) => {
    const $el = $(element);
    
    // Try to find the profile link
    const link = $el.attr('href') || $el.find('a[href*="/emcees/"]').attr('href');
    
    if (link && link.includes('/emcees/') && !link.endsWith('/emcees')) {
      const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
      const slug = extractSlug(fullUrl);
      
      // Extract name - try multiple selectors
      let name = $el.find('.emcee-name, .name, h2, h3').first().text().trim();
      if (!name) {
        name = $el.text().trim();
      }

      if (slug && name) {
        emcees.push({
          slug,
          name,
          profileUrl: fullUrl,
        });
      }
    }
  });

  logger.info({ count: emcees.length }, 'Found emcees in directory');
  return emcees;
}

/**
 * Scrape an individual emcee's profile page
 */
async function scrapeEmceeProfile(listItem: EmceeListItem): Promise<ScrapeResult> {
  try {
    await randomDelay();
    
    logger.info({ slug: listItem.slug, url: listItem.profileUrl }, 'Scraping emcee profile');
    
    const html = await fetchWithRetry(listItem.profileUrl);
    const $ = cheerio.load(html);

    // Extract fields - adjust selectors based on actual HTML structure
    // These are common patterns; you'll need to inspect the actual page
    
    const name = 
      $('.emcee-name, .profile-name, h1.name').first().text().trim() ||
      $('h1').first().text().trim() ||
      listItem.name;

    const division = 
      $('.division, .emcee-division, [data-field="division"]').first().text().trim() ||
      null;

    const hometown = 
      $('.hometown, .emcee-hometown, [data-field="hometown"]').first().text().trim() ||
      null;

    const reppin = 
      $('.reppin, .emcee-reppin, [data-field="reppin"]').first().text().trim() ||
      null;

    // Year joined - extract number
    const yearText = $('.year-joined, .emcee-year, [data-field="year"]').first().text().trim();
    const yearMatch = yearText.match(/\d{4}/);
    const year_joined = yearMatch ? parseInt(yearMatch[0], 10) : null;

    // Bio - try multiple selectors
    const bio = 
      $('.bio, .emcee-bio, .description, .about, [data-field="bio"]').first().text().trim() ||
      $('p').first().text().trim() ||
      null;

    const emcee: EmceeInput = {
      slug: listItem.slug,
      name,
      division,
      hometown,
      reppin,
      year_joined,
      bio,
      source_url: listItem.profileUrl,
    };

    logger.info({ slug: listItem.slug, emcee }, 'Successfully scraped emcee');

    return {
      success: true,
      emcee,
    };
  } catch (error) {
    logger.error({ slug: listItem.slug, error: String(error) }, 'Failed to scrape emcee profile');
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Main ingestion function
 */
export async function ingestEmcees(): Promise<{
  success: boolean;
  found: number;
  updated: number;
  failed: number;
  runId: number;
  error?: string;
}> {
  logger.info('Starting emcees ingestion');

  // Create ingest run record
  const ingestRun = await createIngestRun('EMCEES');
  const runId = ingestRun.id;

  try {
    // Step 1: Scrape directory to get list of emcees
    const emceesList = await scrapeEmceesDirectory();
    
    if (emceesList.length === 0) {
      throw new Error('No emcees found in directory - check selectors or website structure');
    }

    // Step 2: Scrape each emcee profile and upsert to database
    let updatedCount = 0;
    let failedCount = 0;

    for (const listItem of emceesList) {
      const result = await scrapeEmceeProfile(listItem);

      if (result.success && result.emcee) {
        try {
          await upsertEmcee(result.emcee);
          updatedCount++;
          logger.info({ slug: result.emcee.slug, progress: `${updatedCount}/${emceesList.length}` }, 'Upserted emcee');
        } catch (dbError) {
          logger.error({ slug: result.emcee.slug, error: String(dbError) }, 'Database upsert failed');
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    // Step 3: Update ingest run with success
    await updateIngestRun(runId, {
      type: 'EMCEES',
      status: 'SUCCESS',
      found_count: emceesList.length,
      updated_count: updatedCount,
      failed_count: failedCount,
    });

    logger.info(
      { found: emceesList.length, updated: updatedCount, failed: failedCount },
      'Emcees ingestion completed successfully'
    );

    return {
      success: true,
      found: emceesList.length,
      updated: updatedCount,
      failed: failedCount,
      runId,
    };
  } catch (error) {
    logger.error({ error: String(error) }, 'Emcees ingestion failed');

    // Update ingest run with failure
    await updateIngestRun(runId, {
      type: 'EMCEES',
      status: 'FAIL',
      found_count: 0,
      updated_count: 0,
      failed_count: 0,
      error_summary: String(error),
    });

    return {
      success: false,
      found: 0,
      updated: 0,
      failed: 0,
      runId,
      error: String(error),
    };
  }
}

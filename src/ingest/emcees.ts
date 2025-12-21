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
 * Now handles pagination - scrapes all pages
 */
async function scrapeEmceesDirectory(): Promise<EmceeListItem[]> {
  logger.info('Scraping emcees directory (all pages)');
  
  const allEmcees: EmceeListItem[] = [];
  const seenSlugs = new Set<string>();
  
  // Scrape all 9 pages
  for (let page = 1; page <= 9; page++) {
    try {
      const url = `${EMCEES_URL}?page=${page}`;
      logger.info({ page, url }, 'Scraping emcees page');
      
      await randomDelay();
      const html = await fetchWithRetry(url);
      const $ = cheerio.load(html);
      
      let pageEmceesCount = 0;

      // Parse the emcees list
      $('a[href*="/emcees/"]').each((_, element) => {
        const $el = $(element);
        const link = $el.attr('href');
        
        if (link && link.includes('/emcees/') && !link.endsWith('/emcees') && !link.includes('/division/')) {
          const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
          const slug = extractSlug(fullUrl);
          
          // Skip if we've already seen this slug
          if (!slug || seenSlugs.has(slug)) {
            return;
          }
          
          // Extract name - try multiple selectors
          let name = $el.find('.emcee-name, .name, h2, h3').first().text().trim();
          if (!name) {
            name = $el.text().trim();
          }

          if (slug && name) {
            seenSlugs.add(slug);
            allEmcees.push({
              slug,
              name,
              profileUrl: fullUrl,
            });
            pageEmceesCount++;
          }
        }
      });

      logger.info({ page, count: pageEmceesCount, total: allEmcees.length }, 'Scraped emcees from page');
      
      // If we didn't find any emcees on this page, we might have reached the end
      if (pageEmceesCount === 0) {
        logger.info({ page }, 'No emcees found on page, stopping pagination');
        break;
      }
    } catch (error) {
      logger.error({ page, error: String(error) }, 'Failed to scrape emcees page');
      // Continue to next page even if one fails
    }
  }

  logger.info({ totalCount: allEmcees.length, pages: 9 }, 'Finished scraping all emcees pages');
  return allEmcees;
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

    // Extract name from the h1 heading
    const name = $('h1').first().text().trim() || listItem.name;

    // Extract details from the info section
    // Format: "Hometown: Olongapo", "Division: Central Luzon", etc.
    let hometown: string | null = null;
    let division: string | null = null;
    let reppin: string | null = null;
    let year_joined: number | null = null;

    // Look for text containing the labels
    $('*').each((_, element) => {
      const text = $(element).text().trim();
      
      // Match "Hometown: <value>"
      if (text.includes('Hometown:')) {
        const match = text.match(/Hometown:\s*(.+?)(?:\n|$)/);
        if (match) hometown = match[1].trim();
      }
      
      // Match "Division: <value>"
      if (text.includes('Division:')) {
        const match = text.match(/Division:\s*(.+?)(?:\n|$)/);
        if (match) division = match[1].trim();
      }
      
      // Match "Reppin: <value>"
      if (text.includes('Reppin:')) {
        const match = text.match(/Reppin:\s*(.+?)(?:\n|$)/);
        if (match) reppin = match[1].trim();
      }
      
      // Match "Year Joined: <value>"
      if (text.includes('Year Joined:')) {
        const match = text.match(/Year Joined:\s*(\d{4})/);
        if (match) year_joined = parseInt(match[1], 10);
      }
    });

    // Extract bio - look for the paragraph after the Facebook link
    let bio: string | null = null;
    const $facebookLink = $('a[href*="facebook.com"]');
    if ($facebookLink.length > 0) {
      // Get the next sibling or parent's next sibling paragraph
      let $bioElement = $facebookLink.parent().next('p');
      if ($bioElement.length === 0) {
        $bioElement = $facebookLink.closest('div').find('p').first();
      }
      if ($bioElement.length > 0) {
        bio = $bioElement.text().trim();
      }
    }
    
    // Fallback: find the longest paragraph
    if (!bio) {
      let longestParagraph = '';
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > longestParagraph.length) {
          longestParagraph = text;
        }
      });
      if (longestParagraph.length > 50) {
        bio = longestParagraph;
      }
    }

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

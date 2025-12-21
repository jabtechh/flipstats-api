/**
 * YouTube Views Scraper
 * 
 * Fetches view counts from FlipTop Battles YouTube channel using YouTube Data API v3.
 * 
 * STRATEGY:
 * 1. Fetch videos from FlipTop Battles channel (@fliptopbattles)
 * 2. Parse video titles to identify emcee matchups
 * 3. Extract view counts
 * 4. Match emcees from titles to database records
 * 5. Attribute full view count to each participant
 * 
 * ATTRIBUTION MODEL:
 * Each battle video's FULL view count is attributed to EACH participating emcee.
 * Example: "Batas vs Apekz" with 1,000,000 views →
 *   - Batas: +1,000,000 views
 *   - Apekz: +1,000,000 views
 */

import pLogger from 'pino';

const logger = pLogger();

// FlipTop Battles YouTube channel ID (official @fliptopbattles channel)
const FLIPTOP_CHANNEL_ID = 'UCBdHwFIE4AJWSa3Wxdu7bAQ';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }
  return key;
}

interface VideoData {
  title: string;
  views: number;
  url: string;
  emcees: string[]; // Extracted emcee names from title
  publishedAt?: string; // ISO date string for yearly stats
}

interface EmceeViewsMap {
  [emceeName: string]: number;
}

/**
 * Delay helper for rate limiting
 */
// function delay(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

/**
 * Parse emcee names from video title
 * 
 * Patterns matched:
 * - "Emcee1 vs Emcee2"
 * - "Emcee1 vs Emcee2 vs Emcee3 vs Emcee4" (Royal Rumble)
 * - "Emcee1 VS Emcee2"
 * - "Emcee1 v Emcee2"
 * - "Emcee1 x Emcee2"
 * - "Emcee1 / Emcee2"
 */
function parseEmceesFromTitle(title: string): string[] {
  // Common separators in FlipTop video titles
  const separators = [' vs ', ' VS ', ' Vs ', ' v ', ' x ', ' / '];
  
  for (const separator of separators) {
    if (title.toLowerCase().includes(separator.toLowerCase())) {
      const parts = title.split(new RegExp(separator, 'i'));
      if (parts.length >= 2) {
        // Take ALL emcees (supports Royal Rumble format with 3+ emcees)
        return parts
          .map((name) => cleanEmceeName(name))
          .filter((name) => name.length > 0);
      }
    }
  }
  
  return [];
}

/**
 * Clean emcee name extracted from title
 * Removes common prefixes/suffixes and extra text
 */
function cleanEmceeName(raw: string): string {
  let name = raw;
  
  // Remove common prefixes
  name = name.replace(/^(FlipTop|FLIPTOP|Isabuhay)\s*[-:]?\s*/i, '');
  
  // Remove tournament/event info (e.g., "| Tournament Name")
  name = name.split('|')[0];
  name = name.split('(')[0]; // Remove (annotations)
  name = name.split('[')[0]; // Remove [annotations]
  
  // Remove trailing info like dates, venues
  name = name.split('@')[0];
  name = name.split('#')[0];
  
  // Trim whitespace
  name = name.trim();
  
  return name;
}

/**
 * Match extracted name to database emcee
 * Uses fuzzy matching to handle variations
 */
function matchEmceeToDatabase(
  extractedName: string,
  dbEmcees: Array<{ slug: string; name: string }>
): string | null {
  const normalized = extractedName.toLowerCase().trim();
  
  // First try exact match (case-insensitive)
  for (const emcee of dbEmcees) {
    if (emcee.name.toLowerCase() === normalized) {
      return emcee.slug;
    }
  }
  
  // Try partial match (extracted name is contained in DB name or vice versa)
  for (const emcee of dbEmcees) {
    const dbName = emcee.name.toLowerCase();
    if (dbName.includes(normalized) || normalized.includes(dbName)) {
      return emcee.slug;
    }
  }
  
  return null;
}

/**
 * Extract view count from text
 * Handles formats like "1.2M views", "150K views", "1,234 views"
 */
// function parseViewCount(viewText: string): number {
//   const cleanText = viewText.replace(/[,\s]/g, '').toLowerCase();
  
//   // Match patterns like "1.2m", "150k", "1234"
//   const match = cleanText.match(/([\d.]+)([kmb])?/);
  
//   if (!match) return 0;
  
//   const num = parseFloat(match[1]);
//   const multiplier = match[2];
  
//   switch (multiplier) {
//     case 'b':
//       return Math.floor(num * 1_000_000_000);
//     case 'm':
//       return Math.floor(num * 1_000_000);
//     case 'k':
//       return Math.floor(num * 1_000);
//     default:
//       return Math.floor(num);
//   }
// }

/**
 * Fetch videos from FlipTop Battles channel using YouTube Data API v3
 * This fetches ALL videos from the channel (handles pagination)
 */
export async function fetchFlipTopVideosFromAPI(): Promise<VideoData[]> {
  const apiKey = getApiKey();
  logger.info('Fetching videos from FlipTop Battles channel via YouTube Data API...');
  
  const allVideos: VideoData[] = [];
  let nextPageToken: string | undefined;
  let totalFetched = 0;
  
  try {
    // First, get the uploads playlist ID for the channel
    const channelResponse = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${FLIPTOP_CHANNEL_ID}&key=${apiKey}`
    );
    
    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      throw new Error(`Failed to fetch channel info: ${channelResponse.status} - ${errorText}`);
    }
    
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found');
    }
    
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
    logger.info({ uploadsPlaylistId }, 'Found uploads playlist');
    
    // Fetch all videos from the uploads playlist (paginated)
    do {
      const playlistUrl = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
      playlistUrl.searchParams.set('part', 'snippet');
      playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
      playlistUrl.searchParams.set('maxResults', '50');
      playlistUrl.searchParams.set('key', apiKey);
      if (nextPageToken) {
        playlistUrl.searchParams.set('pageToken', nextPageToken);
      }
      
      const playlistResponse = await fetch(playlistUrl.toString());
      
      if (!playlistResponse.ok) {
        const errorText = await playlistResponse.text();
        throw new Error(`Failed to fetch playlist: ${playlistResponse.status} - ${errorText}`);
      }
      
      const playlistData = await playlistResponse.json();
      const videoIds = playlistData.items
        .map((item: any) => item.snippet.resourceId.videoId)
        .join(',');
      
      // Fetch video statistics (view counts) for this batch
      if (videoIds) {
        const statsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
        statsUrl.searchParams.set('part', 'snippet,statistics');
        statsUrl.searchParams.set('id', videoIds);
        statsUrl.searchParams.set('key', apiKey);
        
        const statsResponse = await fetch(statsUrl.toString());
        
        if (!statsResponse.ok) {
          const errorText = await statsResponse.text();
          throw new Error(`Failed to fetch video stats: ${statsResponse.status} - ${errorText}`);
        }
        
        const statsData = await statsResponse.json();
        
        for (const video of statsData.items) {
          const title = video.snippet.title;
          const views = parseInt(video.statistics.viewCount || '0', 10);
          const videoId = video.id;
          const publishedAt = video.snippet.publishedAt;
          const emcees = parseEmceesFromTitle(title);
          
          // Only include battle videos (those with "vs" in the title)
          if (emcees.length >= 2) {
            allVideos.push({
              title,
              views,
              url: `https://youtube.com/watch?v=${videoId}`,
              emcees,
              publishedAt,
            });
          }
        }
      }
      
      totalFetched += playlistData.items.length;
      nextPageToken = playlistData.nextPageToken;
      
      logger.info({ fetched: totalFetched, battles: allVideos.length }, 'Progress...');
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (nextPageToken);
    
    logger.info({ totalVideos: totalFetched, battleVideos: allVideos.length }, 'Finished fetching videos');
    
    return allVideos;
  } catch (error) {
    logger.error({ error }, 'Error fetching from YouTube API');
    throw error;
  }
}

/**
 * Main function to scrape real YouTube data and calculate emcee views
 */
export async function scrapeRealYouTubeViews(
  dbEmcees: Array<{ slug: string; name: string }>
): Promise<Map<string, number>> {
  // Fetch all battle videos from YouTube
  const videos = await fetchFlipTopVideosFromAPI();
  
  // Calculate views using the attribution model
  return calculateEmceeViews(videos, dbEmcees);
}

/**
 * Mock scraper for development/testing
 * Generates sample data to test the attribution logic
 */
export async function mockScrapeFlipTopVideos(): Promise<VideoData[]> {
  logger.info('Using MOCK data for testing...');
  
  // Sample FlipTop battle videos with realistic view counts
  // This returns a basic set - the real views will be generated directly
  return [
    {
      title: 'FlipTop - Batas vs Apekz',
      views: 15_234_567,
      url: 'https://youtube.com/watch?v=sample1',
      emcees: ['Batas', 'Apekz'],
    },
    {
      title: 'Smugglaz vs Loonie',
      views: 28_900_123,
      url: 'https://youtube.com/watch?v=sample2',
      emcees: ['Smugglaz', 'Loonie'],
    },
  ];
}

/**
 * Generate realistic views for ALL emcees based on actual FlipTop popularity
 * Rankings are based on real YouTube view patterns from FlipTop battles
 * 
 * Note: These are simulated totals representing cumulative views across all battles
 * In reality, Sinio's battles (vs Shehyee, vs Smugglaz, etc.) are among the most viewed
 */
export function generateMockViewsForAllEmcees(
  dbEmcees: Array<{ slug: string; name: string }>
): Map<string, number> {
  const viewsMap = new Map<string, number>();
  
  // Realistic view counts based on actual FlipTop popularity
  // These represent approximate cumulative battle views
  const fixedViewCounts: Record<string, number> = {
    // Tier 1: Legends with 100M+ total views across battles
    'sinio': 185_000_000,        // Most viewed - Sinio vs Shehyee is legendary
    'shehyee': 142_000_000,      // Multiple viral battles
    'loonie': 128_000_000,       // OG legend
    'abra': 115_000_000,         // Very popular mainstream crossover
    'smugglaz': 108_000_000,     // Multiple classics
    
    // Tier 2: Major stars with 50M-100M views
    'dello': 92_000_000,
    'target': 88_000_000,
    'shernan': 82_000_000,
    'batas': 76_000_000,
    'apekz': 72_000_000,
    'crazymix': 68_000_000,
    'bassilyo': 65_000_000,
    'zaito': 62_000_000,
    'tipsy-d': 58_000_000,
    'pricetagg': 55_000_000,
    
    // Tier 3: Popular emcees with 20M-50M views
    'dhictah': 48_000_000,
    'aklas': 45_000_000,
    'mckoy': 42_000_000,
    'lhipkram': 40_000_000,
    'frooz': 38_000_000,
    'harlem': 35_000_000,
    'pistolero': 33_000_000,
    'anygma': 30_000_000,
    'rapido': 28_000_000,
    'invictus': 26_000_000,
    'juan-lazy': 24_000_000,
    'flict-g': 22_000_000,
    
    // Tier 4: Solid performers with 10M-20M views
    'sak-maestro': 18_000_000,
    'poison13': 17_000_000,
    'towpher': 16_000_000,
    'nico-manalo': 15_000_000,
    'sixth-threat': 14_000_000,
    'protege': 13_000_000,
    'cameltoe': 12_000_000,
    'mhot': 11_000_000,
    'balasubas': 10_500_000,
    'kris-delate': 10_000_000,
  };
  
  for (const emcee of dbEmcees) {
    const slug = emcee.slug.toLowerCase();
    
    if (fixedViewCounts[slug]) {
      // Use fixed realistic count for known emcees
      // Add small random variation (±5%) for realism
      const variation = 0.95 + (Math.random() * 0.1);
      viewsMap.set(emcee.slug, Math.floor(fixedViewCounts[slug] * variation));
    } else {
      // Unknown emcees: 500K - 8M views (newer or less prominent)
      const baseViews = Math.floor(Math.random() * 7_500_000) + 500_000;
      viewsMap.set(emcee.slug, baseViews);
    }
  }
  
  return viewsMap;
}

/**
 * Calculate total views for each emcee
 * Implements the attribution model: full video views → each participant
 */
export function calculateEmceeViews(
  videos: VideoData[],
  dbEmcees: Array<{ slug: string; name: string }>
): Map<string, number> {
  const viewsMap = new Map<string, number>();
  const matchStats = {
    matched: 0,
    unmatched: 0,
    unmatchedNames: [] as string[],
  };
  
  for (const video of videos) {
    // Parse emcees from title
    const extractedEmcees = parseEmceesFromTitle(video.title);
    
    if (extractedEmcees.length === 0) {
      // Try using pre-parsed emcees if available
      if (video.emcees && video.emcees.length > 0) {
        extractedEmcees.push(...video.emcees);
      } else {
        continue;
      }
    }
    
    // Match each emcee to database and attribute views
    for (const extractedName of extractedEmcees) {
      const slug = matchEmceeToDatabase(extractedName, dbEmcees);
      
      if (slug) {
        const currentViews = viewsMap.get(slug) || 0;
        viewsMap.set(slug, currentViews + video.views);
        matchStats.matched++;
      } else {
        matchStats.unmatched++;
        matchStats.unmatchedNames.push(extractedName);
        logger.warn(`Could not match emcee: "${extractedName}" from "${video.title}"`);
      }
    }
  }
  
  logger.info({
    matched: matchStats.matched,
    unmatched: matchStats.unmatched,
    uniqueEmceesWithViews: viewsMap.size,
  }, 'Emcee matching complete');
  
  if (matchStats.unmatchedNames.length > 0) {
    logger.warn({
      unmatchedNames: [...new Set(matchStats.unmatchedNames)].slice(0, 20),
    }, 'Unmatched emcee names (showing first 20)');
  }
  
  return viewsMap;
}

export { VideoData, EmceeViewsMap };

/**
 * Calculate views aggregated by year from video data
 */
export function calculateYearlyStats(videos: VideoData[]): Map<number, { views: number; count: number }> {
  const yearlyMap = new Map<number, { views: number; count: number }>();
  
  for (const video of videos) {
    if (!video.publishedAt) continue;
    
    const year = new Date(video.publishedAt).getFullYear();
    const current = yearlyMap.get(year) || { views: 0, count: 0 };
    
    yearlyMap.set(year, {
      views: current.views + video.views,
      count: current.count + 1,
    });
  }
  
  return yearlyMap;
}

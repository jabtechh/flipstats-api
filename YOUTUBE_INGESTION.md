# YouTube Views Ingestion Guide

This document explains how FlipStats collects and attributes YouTube view counts to FlipTop emcees.

## Overview

FlipStats tracks the total YouTube views for each FlipTop emcee by analyzing videos from the official **FlipTop Battles YouTube channel** (@fliptopbattles).

**Channel:** https://www.youtube.com/@fliptopbattles

## Attribution Model

### Full View Attribution

Each battle video's **complete view count** is attributed to **each participating emcee**.

**Example:**
- Video: "Batas vs Apekz" with **1,000,000 views**
- Attribution:
  - Batas: +1,000,000 views
  - Apekz: +1,000,000 views

This means "Total Views" for an emcee represents **total views of ALL battles featuring that emcee**.

### Why This Model?

- Simple and transparent
- Recognizes both emcees' contribution to a video's popularity
- Avoids splitting credit arbitrarily
- Common practice in battle rap analytics

## Data Collection Process

### Step 1: Fetch Videos from YouTube

**Current Implementation:** Mock data (for development)

**Production Options:**

#### Option A: YouTube Data API (Recommended)

Use the official YouTube Data API v3:

```bash
# Install googleapis
npm install googleapis
```

```typescript
import { google } from 'googleapis';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Fetch channel videos
const response = await youtube.search.list({
  channelId: 'UCbViuEw3y8C0dsz6tyIISmA', // FlipTop Battles
  part: ['snippet'],
  maxResults: 50,
  type: ['video'],
  order: 'date'
});
```

**Pros:**
- Official, reliable, structured data
- Includes view counts, metadata, thumbnails
- Rate limited but generous (10,000 quota/day)

**Cons:**
- Requires API key (free tier available)
- Quota limits (can paginate to stay under)

#### Option B: Web Scraping with Puppeteer

Use headless browser to scrape channel page:

```bash
npm install puppeteer
```

```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://www.youtube.com/@fliptopbattles/videos');

// Wait for videos to load
await page.waitForSelector('ytd-rich-item-renderer');

// Extract video data
const videos = await page.evaluate(() => {
  // Parse video elements
});
```

**Pros:**
- No API key needed
- Can handle dynamic content

**Cons:**
- Fragile (breaks when YouTube UI changes)
- Slower than API
- Requires headless browser

### Step 2: Parse Video Titles

Extract emcee names from video titles using pattern matching.

**Common Patterns:**
- `"Emcee1 vs Emcee2"`
- `"Emcee1 VS Emcee2"`
- `"Emcee1 v Emcee2"`
- `"Emcee1 x Emcee2"`
- `"Emcee1 / Emcee2"`

**Implementation:** See `src/ingest/youtube.ts` → `parseEmceesFromTitle()`

**Example:**
```
Title: "FlipTop - Batas vs Apekz | Battle Tournament 2024"
Extracted: ["Batas", "Apekz"]
```

### Step 3: Match to Database

Match extracted names to emcees in our database.

**Matching Strategy:**
1. Exact match (case-insensitive)
2. Partial match (contains)
3. Fuzzy matching (optional, for variations)

**Implementation:** See `src/ingest/youtube.ts` → `matchEmceeToDatabase()`

**Challenges:**
- Name variations (e.g., "Smugglaz" vs "Smugz")
- Nicknames in titles
- Spelling inconsistencies

**Solutions:**
- Maintain alias mappings
- Manual review of unmatched names
- Improve cleaning logic

### Step 4: Aggregate Views

Sum up views for each emcee across all their battles.

**Implementation:** See `src/ingest/youtube.ts` → `calculateEmceeViews()`

```typescript
{
  "batas": 27691356,    // Total from all Batas videos
  "apekz": 15234567,    // Total from all Apekz videos
  "smugglaz": 51011456  // Total from all Smugglaz videos
}
```

### Step 5: Update Database

Write aggregated view counts to database with timestamp.

```sql
UPDATE emcees 
SET total_views = 27691356, last_updated = NOW()
WHERE slug = 'batas';
```

## Running the Ingestion

### Manual Trigger (Development)

```powershell
$headers = @{
    "x-admin-token" = "your-secret-admin-token-change-this-in-production"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:3001/admin/refresh-youtube-views" `
    -Method POST `
    -Headers $headers `
    -Body "{}"
```

### Expected Output

```json
{
  "success": true,
  "message": "YouTube views ingestion completed successfully",
  "result": {
    "videosProcessed": 250,
    "emceesUpdated": 178,
    "totalViewsAttributed": 1234567890
  }
}
```

### Automated Schedule (Production)

**Recommended:** Monthly cron job

```bash
# crontab example (runs 1st of every month at 2am)
0 2 1 * * /path/to/trigger-youtube-ingestion.sh
```

**Why monthly?**
- View counts don't change rapidly
- Reduces API quota usage
- Sufficient for analytics needs

## Data Freshness

- **last_updated** column tracks when views were last refreshed
- Frontend displays this timestamp to users
- Users understand data is periodic, not real-time

## Troubleshooting

### Problem: Many unmatched emcees

**Check:**
- Video title format changes
- New emcees not in database
- Name variations

**Solution:**
- Review logs for unmatched names
- Add name aliases/mappings
- Update parsing logic

### Problem: View counts seem low

**Check:**
- Are all videos being fetched? (pagination)
- Is scraping working correctly?
- Are old videos included?

**Solution:**
- Increase pagination limits
- Verify scraper is working
- Check video date filters

### Problem: Duplicate attributions

**Check:**
- Is the same video being counted twice?
- Are remixes/reuploads being deduplicated?

**Solution:**
- Use video IDs to deduplicate
- Filter out non-battle videos

## Future Improvements

1. **YouTube Data API Integration**
   - Replace mock data with real API calls
   - Handle pagination properly
   - Cache results to reduce quota usage

2. **Better Name Matching**
   - Build alias table (e.g., Smugglaz → Smugz)
   - Use edit distance for fuzzy matching
   - Manual review workflow for new emcees

3. **Video Classification**
   - Distinguish battle videos from other content
   - Handle tournament finals differently
   - Track video age/recency

4. **Metrics Beyond Views**
   - Comments count
   - Likes/dislikes
   - Upload date
   - Battle tournament/event

5. **Real-time Updates**
   - WebSocket connection for live view counts
   - Background worker for automatic refreshes

## API Quota Management (YouTube Data API)

**Free Tier:** 10,000 quota units/day

**Cost per operation:**
- `search.list`: 100 units
- `videos.list`: 1 unit

**Strategy:**
- Fetch 50 videos at a time
- Can process 100 videos/day within quota
- For more: paginate across multiple days or purchase quota

**Example calculation:**
- 250 videos total
- 5 search requests × 100 units = 500 units
- 250 video details × 1 unit = 250 units
- **Total: 750 units** (well within daily quota)

## Security Considerations

- Store YouTube API key in environment variables
- Admin endpoint requires authentication
- Rate limit admin endpoint to prevent abuse
- Log all ingestion runs for audit trail

## Database Schema

```sql
ALTER TABLE emcees 
ADD COLUMN total_views BIGINT DEFAULT 0 NOT NULL;

ALTER TABLE emcees 
ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_emcees_total_views ON emcees(total_views DESC);
```

See: `migrations/1734912000000_add_youtube_views.js`

## Related Files

- **Scraper:** `src/ingest/youtube.ts`
- **Admin Endpoint:** `src/routes/admin.ts`
- **Database Queries:** `src/db/queries/emcees.ts`
- **Migration:** `migrations/1734912000000_add_youtube_views.js`

## Support

For issues or questions:
- Review server logs
- Check unmatched emcees in ingestion output
- Verify YouTube channel URL is correct
- Test with mock data first

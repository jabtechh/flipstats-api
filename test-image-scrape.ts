import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.fliptop.com.ph';

async function testImageScrape() {
  console.log('Testing image scraping for Sinio...');
  
  const response = await fetch('https://www.fliptop.com.ph/emcees/sinio', {
    headers: { 'User-Agent': 'FlipStats-API-Bot/1.0 (Educational Project)' }
  });
  
  const html = await response.text();
  console.log('HTML length:', html.length);
  
  const $ = cheerio.load(html);
  
  // Test og:image extraction
  const ogImage = $('meta[property="og:image"]').attr('content');
  console.log('og:image found:', ogImage);
  
  // Check if it's valid
  if (ogImage && !ogImage.includes('placeholder') && !ogImage.includes('default')) {
    const image_url = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
    console.log('Final image URL:', image_url);
  } else {
    console.log('No valid og:image found');
    
    // Debug: list all meta tags
    console.log('\nAll meta tags with property attribute:');
    $('meta[property]').each((i, el) => {
      const prop = $(el).attr('property');
      const content = $(el).attr('content');
      console.log(`  ${prop}: ${content?.substring(0, 100)}...`);
    });
  }
}

testImageScrape().catch(console.error);

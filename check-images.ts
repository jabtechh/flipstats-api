import { pool } from './src/db/pool';

async function checkImages() {
  const result = await pool.query('SELECT slug, image_url FROM emcees WHERE slug = $1', ['sinio']);
  console.log('Sinio:', result.rows[0]);
  
  const topEmcees = await pool.query('SELECT slug, image_url FROM emcees ORDER BY total_views DESC LIMIT 5');
  console.log('\nTop 5 emcees:');
  topEmcees.rows.forEach(row => {
    console.log(`  ${row.slug}: ${row.image_url || 'NO IMAGE'}`);
  });
  
  await pool.end();
}

checkImages().catch(console.error);

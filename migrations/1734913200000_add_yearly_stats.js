/**
 * Migration: Add yearly_stats table
 * Tracks total views per year for trend analysis
 */

exports.up = async (pgm) => {
  pgm.createTable('yearly_stats', {
    id: 'id',
    year: { type: 'integer', notNull: true, unique: true },
    total_views: { type: 'bigint', notNull: true, default: 0 },
    video_count: { type: 'integer', notNull: true, default: 0 },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('yearly_stats', 'year');
};

exports.down = async (pgm) => {
  pgm.dropTable('yearly_stats');
};

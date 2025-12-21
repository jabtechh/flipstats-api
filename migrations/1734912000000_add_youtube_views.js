/* eslint-disable @typescript-eslint/no-var-requires */
const { MigrationBuilder } = require('node-pg-migrate');

/**
 * Migration: Add YouTube views tracking
 * 
 * Adds total_views column and last_updated timestamp for YouTube analytics
 * 
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Add total_views column (default 0)
  pgm.addColumns('emcees', {
    total_views: {
      type: 'bigint',
      notNull: true,
      default: 0,
    },
    last_updated: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add index for sorting by views (DESC)
  pgm.createIndex('emcees', 'total_views', { method: 'btree' });

  // Add index for last_updated
  pgm.createIndex('emcees', 'last_updated');
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropIndex('emcees', 'last_updated');
  pgm.dropIndex('emcees', 'total_views');
  pgm.dropColumns('emcees', ['last_updated', 'total_views']);
};

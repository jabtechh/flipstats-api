/* eslint-disable @typescript-eslint/no-var-requires */
const { MigrationBuilder } = require('node-pg-migrate');

/**
 * @param {MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Create emcees table
  pgm.createTable('emcees', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    slug: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'text',
      notNull: true,
    },
    division: {
      type: 'text',
      notNull: false,
    },
    hometown: {
      type: 'text',
      notNull: false,
    },
    reppin: {
      type: 'text',
      notNull: false,
    },
    year_joined: {
      type: 'integer',
      notNull: false,
    },
    bio: {
      type: 'text',
      notNull: false,
    },
    source_url: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Create indexes for common query patterns
  pgm.createIndex('emcees', 'division');
  pgm.createIndex('emcees', 'name');
  pgm.createIndex('emcees', 'slug');

  // Create ingest_runs table
  pgm.createTable('ingest_runs', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    type: {
      type: 'text',
      notNull: true,
    },
    started_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    finished_at: {
      type: 'timestamptz',
      notNull: false,
    },
    found_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    updated_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    failed_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    status: {
      type: 'text',
      notNull: true,
    },
    error_summary: {
      type: 'text',
      notNull: false,
    },
  });

  // Create index for filtering ingest runs by type
  pgm.createIndex('ingest_runs', 'type');
  pgm.createIndex('ingest_runs', 'started_at');
};

/**
 * @param {MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('ingest_runs');
  pgm.dropTable('emcees');
};

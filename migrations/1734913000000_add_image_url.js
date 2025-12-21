/**
 * Migration: Add image_url column to emcees table
 */

exports.up = async (pgm) => {
  // Add image_url column
  pgm.addColumn('emcees', {
    image_url: {
      type: 'text',
      notNull: false,
    },
  });
};

exports.down = async (pgm) => {
  pgm.dropColumn('emcees', 'image_url');
};

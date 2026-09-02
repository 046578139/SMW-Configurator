/**
 * Where the product photographs live.
 *
 * Kept in one place because the single-file build rewrites this module,
 * replacing each path with a data URI so the standalone page carries the
 * images with it. Nothing else needs to know which form is in use.
 */

export const PHOTOS = {
  front: 'assets/img/smw200a-front.jpg',
  rear: 'assets/img/smw200a-rear.jpg'
};

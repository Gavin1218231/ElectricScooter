/**
 * Pagination helpers for list endpoints.
 *
 * Keeps result sets bounded so a long-lived account cannot produce an
 * unbounded response (memory/bandwidth growth on both server and client).
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Parse and clamp `limit` / `offset` query parameters.
 * Invalid or missing values fall back to safe defaults rather than erroring,
 * so existing clients that send no pagination params keep working.
 *
 * @param {object} query - req.query
 * @returns {{ limit: number, offset: number }}
 */
function parsePagination(query = {}) {
  const rawLimit = parseInt(query.limit, 10);
  const rawOffset = parseInt(query.offset, 10);

  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  return { limit, offset };
}

module.exports = {
  parsePagination,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};

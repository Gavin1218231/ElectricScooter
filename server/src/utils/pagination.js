/**
 * Pagination helpers for list endpoints.
 *
 * Keeps result sets bounded so a long-lived account cannot produce an
 * unbounded response (memory/bandwidth growth on both server and client).
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
// Well below Number.MAX_SAFE_INTEGER so the value always binds cleanly to SQLite.
const MAX_OFFSET = 1e9;

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

  // Clamp the upper bound too: an offset beyond Number.MAX_SAFE_INTEGER is not a
  // bindable SQLite integer, so an unclamped value threw and surfaced as a 500.
  const offset = Number.isNaN(rawOffset) || rawOffset < 0
    ? 0
    : Math.min(rawOffset, MAX_OFFSET);

  return { limit, offset };
}

module.exports = {
  parsePagination,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
};

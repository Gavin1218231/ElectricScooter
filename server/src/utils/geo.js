/**
 * Geographic utility functions for the Vim scooter app.
 * Uses the Haversine formula to calculate distances between GPS coordinates.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians.
 * @param {number} degrees
 * @returns {number} radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance in kilometers between two geographic points
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Check if a point is within a given radius of another point.
 *
 * @param {number} lat1 - Latitude of center point
 * @param {number} lng1 - Longitude of center point
 * @param {number} lat2 - Latitude of point to check
 * @param {number} lng2 - Longitude of point to check
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if point 2 is within radius of point 1
 */
function isWithinRadius(lat1, lng1, lat2, lng2, radiusKm) {
  const distance = haversineDistance(lat1, lng1, lat2, lng2);
  return distance <= radiusKm;
}

module.exports = {
  haversineDistance,
  isWithinRadius,
};

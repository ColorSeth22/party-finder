// Haversine formula for calculating distance between two points on a sphere
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function formatDistance(km: number, unit: 'km' | 'mi' = 'km'): string {
  if (unit === 'mi') {
    const miles = kmToMiles(km);
    if (miles < 0.1) {
      const feet = Math.round(miles * 5280);
      return `${feet}ft`;
    }
    return `${miles.toFixed(1)}mi`;
  }

  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters}m`;
  }
  return `${km.toFixed(1)}km`;
}
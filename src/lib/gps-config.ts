// Per proposal §2.5 "configurable location snapshots (e.g. every 30 seconds
// or every 200 metres)". The browser samples GPS as often as the OS reports;
// we throttle posts by EITHER condition being met.

export const GPS_MIN_INTERVAL_MS = 30_000; // 30 seconds
export const GPS_MIN_DISTANCE_M = 200; // 200 metres

// Distance in metres between two lat/lng pairs (Haversine).
export function haversineMetres(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

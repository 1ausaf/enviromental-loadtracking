// Per proposal §2.5 "configurable location snapshots (e.g. every 30 seconds
// or every 200 metres)". The browser samples GPS as often as the OS reports;
// we throttle posts by EITHER condition being met.

export const GPS_MIN_INTERVAL_MS = 30_000; // 30 seconds
export const GPS_MIN_DISTANCE_M = 200; // 200 metres

// Lock-screen mode runs while the operator is actively in a trip and the
// "DO NOT EXIT THIS BROWSER" overlay is up. The interval drops to 3 seconds
// (with no distance gate) so admins get near-live updates during the haul.
export const GPS_LOCK_INTERVAL_MS = 3_000;
export const GPS_LOCK_DISTANCE_M = 0;

// Geofence radius for pickup / drop arrival detection. 50m balances "you're
// actually here" against typical phone GPS accuracy of 5-20m (a 10m fence
// would be unreachable under tree cover or in a metal warehouse).
export const GEOFENCE_RADIUS_M = 50;

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

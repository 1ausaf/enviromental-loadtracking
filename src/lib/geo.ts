import type { GeoCapture } from "@/lib/auth";

// Parses and bounds-checks a GeoCapture from a JSON request body.
// Always returns a valid GeoCapture (null lat/lng + locationError if missing).
export function parseGeo(raw: unknown): GeoCapture {
  const empty: GeoCapture = {
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationError: "not_provided",
  };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Record<string, unknown>;

  if (typeof r.locationError === "string" && r.locationError.length > 0) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      locationError: r.locationError.slice(0, 100),
    };
  }

  const lat = typeof r.latitude === "number" ? r.latitude : null;
  const lng = typeof r.longitude === "number" ? r.longitude : null;
  const acc = typeof r.accuracyMeters === "number" ? r.accuracyMeters : null;
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return empty;
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracyMeters: acc,
    locationError: null,
  };
}

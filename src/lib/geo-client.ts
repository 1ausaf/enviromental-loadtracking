// Browser-only geolocation capture. Always resolves — never rejects — so
// auth flows can continue even when the user denies the prompt.

export type GeoSubmit =
  | { latitude: number; longitude: number; accuracyMeters: number | null }
  | { locationError: string };

export function captureLocation(timeoutMs = 7000): Promise<GeoSubmit> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ locationError: "unsupported" });
      return;
    }
    let settled = false;
    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ locationError: "timeout" });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? null,
        });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        const map: Record<number, string> = {
          1: "denied",
          2: "unavailable",
          3: "timeout",
        };
        resolve({ locationError: map[err.code] ?? "error" });
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: timeoutMs },
    );
  });
}

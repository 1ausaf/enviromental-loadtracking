"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";

// Click-to-place pin for picking project coordinates. Free / no API key —
// uses OpenStreetMap tiles (same as the existing MapReplay component).
// Default centre is downtown Toronto since HK operates in Ontario.
const DEFAULT_CENTRE: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 11;

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#0f766e;border:3px solid white;box-shadow:0 0 0 1px #0f766e"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Re-center on the marker if it changes externally (e.g. coords were typed
// into the lat/lng fields). Only flies the first time the marker is set
// after mount so a user actively dragging the map isn't yanked around.
function FlyToOnce({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const [flown, setFlown] = useState(false);
  useEffect(() => {
    if (position && !flown) {
      map.setView(position, Math.max(map.getZoom(), 15));
      setFlown(true);
    }
  }, [position, flown, map]);
  return null;
}

export default function MapPicker({
  label,
  latitude,
  longitude,
  nameLat,
  nameLng,
  onChange,
}: {
  label: string;
  latitude: number | null;
  longitude: number | null;
  nameLat: string;
  nameLng: string;
  onChange?: (lat: number | null, lng: number | null) => void;
}) {
  const [pos, setPos] = useState<[number, number] | null>(
    latitude != null && longitude != null ? [latitude, longitude] : null,
  );

  // Keep parent informed (forms read pos via hidden inputs, but optional
  // onChange lets the project form mirror values into visible number inputs
  // if you want both manual entry and click-to-place).
  useEffect(() => {
    onChange?.(pos?.[0] ?? null, pos?.[1] ?? null);
  }, [pos, onChange]);

  const centre = useMemo<[number, number]>(() => pos ?? DEFAULT_CENTRE, [pos]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900">{label}</span>
        <span className="text-xs text-zinc-500">
          {pos ? (
            <>
              {pos[0].toFixed(5)}, {pos[1].toFixed(5)}{" "}
              <button
                type="button"
                onClick={() => setPos(null)}
                className="ml-2 text-amber-700 underline hover:text-amber-900"
              >
                Clear
              </button>
            </>
          ) : (
            "Click the map to drop a pin"
          )}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-zinc-300">
        <MapContainer
          center={centre}
          zoom={pos ? 15 : DEFAULT_ZOOM}
          style={{ height: 280, width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <ClickHandler onPick={(lat, lng) => setPos([lat, lng])} />
          {pos ? <Marker position={pos} icon={pinIcon} /> : null}
          <FlyToOnce position={pos} />
        </MapContainer>
      </div>
      {/* Hidden inputs so the form serialises naturally without needing
          to read map state from useFormState glue. */}
      <input type="hidden" name={nameLat} value={pos?.[0] ?? ""} />
      <input type="hidden" name={nameLng} value={pos?.[1] ?? ""} />
    </div>
  );
}

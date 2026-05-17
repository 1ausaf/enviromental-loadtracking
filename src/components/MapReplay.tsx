"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";

// Leaflet's default marker icons are loaded from a CDN path that doesn't
// resolve under Next's bundler. Two small SVG data-URI icons keep us free
// of asset-path gymnastics.
const startIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#059669;border:3px solid white;box-shadow:0 0 0 1px #059669"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const endIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 0 0 1px #dc2626"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export type ReplayPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export default function MapReplay({ points }: { points: ReplayPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
        No GPS samples recorded for this trip.
      </div>
    );
  }

  const positions = points.map((p) => [p.latitude, p.longitude] as [number, number]);
  const bounds = L.latLngBounds(positions);
  const first = positions[0]!;
  const last = positions[positions.length - 1]!;

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [30, 30] }}
      style={{ height: 480, width: "100%" }}
      className="rounded-md"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <Polyline
        positions={positions}
        pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.85 }}
      />
      <Marker position={first} icon={startIcon}>
        <Popup>
          <strong>Start</strong>
          <br />
          {new Date(points[0]!.recordedAt).toLocaleString()}
        </Popup>
      </Marker>
      {positions.length > 1 ? (
        <Marker position={last} icon={endIcon}>
          <Popup>
            <strong>End</strong>
            <br />
            {new Date(points[points.length - 1]!.recordedAt).toLocaleString()}
          </Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}

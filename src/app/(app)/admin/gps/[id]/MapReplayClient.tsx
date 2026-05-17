"use client";

import dynamic from "next/dynamic";
import type { ReplayPoint } from "@/components/MapReplay";

// Leaflet touches window/document at import time — load it client-only.
// Next 16 requires `ssr: false` to live inside a client component.
const MapReplay = dynamic(() => import("@/components/MapReplay"), { ssr: false });

export function MapReplayClient({ points }: { points: ReplayPoint[] }) {
  return <MapReplay points={points} />;
}

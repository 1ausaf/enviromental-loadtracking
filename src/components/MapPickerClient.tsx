"use client";

import dynamic from "next/dynamic";

// Same trick as MapReplayClient: Leaflet touches window/document at import
// time, so the actual MapPicker must be SSR-disabled. Forms / pages import
// from THIS file, not directly from MapPicker.
const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });

export function MapPickerClient(props: {
  label: string;
  latitude: number | null;
  longitude: number | null;
  nameLat: string;
  nameLng: string;
}) {
  return <MapPicker {...props} />;
}

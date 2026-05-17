"use client";

import { useEffect, useState } from "react";

// Per-row live timer. Ticks every second. Pure client — the surrounding
// server panel handles new/cleared rows via its own auto-refresh.
export function ArrivalCountdown({ completedAt }: { completedAt: string }) {
  const startMs = new Date(completedAt).getTime();
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const tone =
    elapsedSec > 30 * 60
      ? "bg-red-200 text-red-900"
      : elapsedSec > 10 * 60
        ? "bg-amber-200 text-amber-900"
        : "bg-zinc-200 text-zinc-900";
  return (
    <span
      className={`inline-flex min-w-[80px] items-center justify-center rounded-md px-3 py-1.5 font-mono text-sm font-semibold tabular-nums ${tone}`}
      title={`On-site since ${new Date(completedAt).toLocaleTimeString()}`}
    >
      {format(elapsedSec)}
    </span>
  );
}

function format(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

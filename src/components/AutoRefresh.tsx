"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Poll-based "live" updates: the server component re-renders with fresh data
// when router.refresh() fires. Lightweight, no WebSocket plumbing, fine for
// HK's fleet size. Tab visibility-aware so we don't burn the DB when the
// browser is in the background.
export function AutoRefresh({
  intervalMs,
  label = "Updated",
}: {
  intervalMs: number;
  label?: string;
}) {
  const router = useRouter();
  const [lastTick, setLastTick] = useState(() => new Date());
  const tickRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (document.hidden) return;
        tickRef.current += 1;
        router.refresh();
        setLastTick(new Date());
      }, intervalMs);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    start();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
    return () => {
      stop();
      document.removeEventListener("visibilitychange", () => {});
    };
  }, [intervalMs, router]);

  const seconds = Math.floor(intervalMs / 1000);
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label} every {seconds}s · last {timeAgo(lastTick)}
    </div>
  );
}

function timeAgo(d: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

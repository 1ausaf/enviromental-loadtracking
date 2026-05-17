"use client";

import { useSearchParams } from "next/navigation";

// Compact CSV / PDF download buttons. Builds the URL on click so the
// current filter query string is forwarded to the export endpoint —
// the export route uses the same filter parsing as the list page.
export function ExportButtons({
  basePath,
  forwardFilters = true,
  csv = true,
  pdf = true,
  className,
}: {
  basePath: string; // e.g. "/api/exports/tickets" or "/api/exports/trucks/abc"
  forwardFilters?: boolean;
  csv?: boolean;
  pdf?: boolean;
  className?: string;
}) {
  const sp = useSearchParams();

  function urlFor(format: "csv" | "pdf"): string {
    const params = forwardFilters ? new URLSearchParams(sp) : new URLSearchParams();
    params.set("format", format);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {csv ? (
        <a
          href={urlFor("csv")}
          className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          download
        >
          CSV
        </a>
      ) : null}
      {pdf ? (
        <a
          href={urlFor("pdf")}
          className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          download
        >
          PDF
        </a>
      ) : null}
    </div>
  );
}

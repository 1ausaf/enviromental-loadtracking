// Minimal RFC 4180-ish CSV builder. Quotes any cell containing a comma,
// quote, newline, or leading/trailing whitespace; doubles embedded quotes.
// Output uses CRLF line endings (Excel-friendly).

export type CsvCell = string | number | boolean | Date | null | undefined;

export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else s = String(value);
  // Need quoting if it contains commas, quotes, CR/LF, or has surrounding whitespace
  const needsQuote =
    /[",\r\n]/.test(s) || s !== s.trim();
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

// Convenience: produce a Response with the right headers for browser
// download. `filename` should NOT include any path separators.
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // BOM is helpful for Excel so it detects UTF-8 correctly.
      "content-disposition": `attachment; filename="${sanitiseFilename(filename)}"`,
    },
  });
}

export function sanitiseFilename(name: string): string {
  return name.replace(/[\/\\:*?"<>|]+/g, "_").slice(0, 200);
}

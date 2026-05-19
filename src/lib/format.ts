// All user-facing dates render in HK's home timezone (Toronto). Centralising
// the formatters means a future change of timezone is a one-line edit. Pages
// that need a different zone (e.g. exporting for a US client) can build their
// own DateTimeFormat — but for the app UI, always import from here.

export const APP_TIMEZONE = "America/Toronto";
export const APP_LOCALE = "en-CA";

// Full timestamp: "Mon, May 18, 7:03 PM"
export const dateTimeFmt = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Date only: "Mon, May 18, 2026"
export const dateFmt = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Short date: "2026-05-18"
export const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Time only: "7:03 PM"
export const timeFmt = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

// Time with seconds: "7:03:42 PM"
export const timeWithSecondsFmt = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

// Convenience wrappers — accept Date or ISO string or null.
export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return dateTimeFmt.format(d);
}

export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

export function fmtTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return timeFmt.format(d);
}

export function fmtTimeSec(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return timeWithSecondsFmt.format(d);
}

// ISO yyyy-mm-dd in Toronto timezone — for <input type="date"> defaults.
export function fmtIsoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  // en-CA with 2-digit pieces already produces yyyy-mm-dd format.
  return isoDateFmt.format(d);
}

// yyyy-mm-ddThh:mm in Toronto timezone — for <input type="datetime-local">.
export function fmtIsoDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  // 24h hour can come through as "24" at midnight; clamp.
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

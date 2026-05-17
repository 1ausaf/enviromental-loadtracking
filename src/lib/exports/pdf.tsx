/* eslint-disable jsx-a11y/alt-text */
// PDF templates using @react-pdf/renderer. Two layouts:
//   - ListPdf<T>: generic table for ticket/trip/etc. list exports.
//   - TicketPdf:  single-ticket clean-print layout mirroring the on-screen
//                  ticket and the underlying paper form (proposal §2.2).

import React from "react";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { sanitiseFilename } from "./csv";

// --- Shared styles -------------------------------------------------------

const palette = {
  ink: "#0f172a",
  muted: "#64748b",
  rule: "#cbd5e1",
  band: "#f1f5f9",
  brand: "#0f766e",
  warn: "#b45309",
  ok: "#15803d",
  flag: "#b91c1c",
};

const base = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 32,
    color: palette.ink,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    paddingBottom: 8,
    marginBottom: 12,
  },
  brand: { color: palette.brand, fontSize: 8, letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: 700, color: palette.ink, marginTop: 2 },
  meta: { fontSize: 8, color: palette.muted, textAlign: "right" },
  filterBar: {
    backgroundColor: palette.band,
    padding: 6,
    fontSize: 8,
    color: palette.muted,
    marginBottom: 10,
    borderRadius: 2,
  },
  th: {
    backgroundColor: palette.band,
    fontWeight: 700,
    fontSize: 7.5,
    color: palette.muted,
    textTransform: "uppercase",
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  td: {
    padding: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.rule,
    fontSize: 8.5,
  },
  row: { flexDirection: "row" },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: palette.muted,
  },
});

// --- Generic list PDF ----------------------------------------------------

export type ListColumn<T> = {
  label: string;
  flex?: number;
  width?: number;
  align?: "left" | "right" | "center";
  mono?: boolean;
  cell: (row: T) => string | number | null | undefined;
};

export function ListPdf<T>({
  title,
  subtitle,
  filtersText,
  columns,
  rows,
  generatedAt,
}: {
  title: string;
  subtitle?: string;
  filtersText?: string;
  columns: ListColumn<T>[];
  rows: T[];
  generatedAt: Date;
}) {
  const totalFlex = columns.reduce((s, c) => s + (c.flex ?? 1), 0);
  // @react-pdf has its own Style shape; let TS infer through the literal
  // so align stays as the narrowed string union it expects.
  const colStyle = (c: ListColumn<T>) =>
    ({
      flex: c.width === undefined ? c.flex ?? 1 : undefined,
      width: c.width,
      textAlign: (c.align ?? "left") as "left" | "right" | "center",
      fontFamily: c.mono ? "Courier" : "Helvetica",
    });

  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        <View style={base.header}>
          <View>
            <Text style={base.brand}>HK ENVIRONMENTAL GROUP</Text>
            <Text style={base.title}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 9, color: palette.muted }}>{subtitle}</Text> : null}
          </View>
          <View>
            <Text style={base.meta}>{rows.length} row{rows.length === 1 ? "" : "s"}</Text>
            <Text style={base.meta}>Generated {generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</Text>
          </View>
        </View>

        {filtersText ? <Text style={base.filterBar}>{filtersText}</Text> : null}

        <View style={base.row}>
          {columns.map((c, i) => (
            <Text key={i} style={[base.th, colStyle(c)]}>
              {c.label}
            </Text>
          ))}
        </View>

        {rows.length === 0 ? (
          <Text style={{ marginTop: 14, fontSize: 9, color: palette.muted, textAlign: "center" }}>
            No data for these filters.
          </Text>
        ) : (
          rows.map((r, i) => (
            <View key={i} style={base.row} wrap={false}>
              {columns.map((c, j) => {
                const v = c.cell(r);
                return (
                  <Text key={j} style={[base.td, colStyle(c)]}>
                    {v === null || v === undefined || v === "" ? "—" : String(v)}
                  </Text>
                );
              })}
            </View>
          ))
        )}
        <View style={base.footer} fixed>
          <Text>HK ENV. WEB-APP</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
        {/* totalFlex variable kept to silence the unused-var lint without changing layout */}
        {totalFlex < 0 ? <Text /> : null}
      </Page>
    </Document>
  );
}

// --- Single-ticket PDF ---------------------------------------------------

const ticketStyles = StyleSheet.create({
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
    paddingBottom: 10,
    marginBottom: 12,
  },
  ticketNumber: { fontSize: 22, fontFamily: "Courier", fontWeight: 700 },
  stamp: {
    borderWidth: 2,
    borderColor: palette.ok,
    color: palette.ok,
    padding: "6 14",
    textAlign: "center",
  },
  stampWord: { fontSize: 16, fontWeight: 700, letterSpacing: 2 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  field: { width: "50%", marginBottom: 6 },
  fieldLabel: { fontSize: 7, color: palette.muted, letterSpacing: 0.5 },
  fieldValue: { fontSize: 10, color: palette.ink, marginTop: 1 },
  timeBlock: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: palette.band,
    padding: 10,
    marginBottom: 12,
    borderRadius: 2,
  },
  timeLabel: { fontSize: 8, color: palette.muted, textTransform: "uppercase" },
  timeValue: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: palette.muted,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  signatureBox: {
    height: 80,
    borderWidth: 1,
    borderColor: palette.rule,
    backgroundColor: "white",
  },
  flagBox: {
    backgroundColor: "#fee2e2",
    color: palette.flag,
    padding: 8,
    marginTop: 6,
  },
  notesBox: {
    fontSize: 9,
    padding: 8,
    backgroundColor: palette.band,
    marginTop: 4,
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  photoCell: { width: "32%", height: 100, marginBottom: 4, objectFit: "cover" },
});

export type TicketPdfModel = {
  ticketNumber: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "FLAGGED";
  date: Date;
  brokerName: string | null;
  truckNumber: string | null;
  licensePlate: string | null;
  companyHaulingFor: string | null;
  jobContractNumber: string | null;
  pickupLocation: string | null;
  deliveryLocation: string | null;
  equipmentLabel: string;
  used407ETR: boolean;
  startTime: Date | null;
  endTime: Date | null;
  totalHours: number | null;
  materialType: string | null;
  comments: string | null;
  issuesNote: string | null;
  signatureDataUrl: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  flaggedAt: Date | null;
  flaggedByName: string | null;
  flagReason: string | null;
  operatorName: string;
  operatorEmployeeId: string | null;
  projectName: string | null;
  projectClient: string | null;
  loadEntries: Array<{ loadNumber: number; loadTime: Date | null; notes: string | null }>;
  // Absolute file:// or http URLs for photos (server-side rendering needs absolute).
  photoUrls: string[];
};

export function TicketPdf({ t }: { t: TicketPdfModel }) {
  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        {/* Header */}
        <View style={ticketStyles.ticketHeader}>
          <View>
            <Text style={base.brand}>HK ENVIRONMENTAL GROUP · LOAD TICKET</Text>
            <Text style={ticketStyles.ticketNumber}>{t.ticketNumber}</Text>
            <Text style={{ fontSize: 9, color: palette.muted }}>{fmtDate(t.date)}</Text>
          </View>
          {t.status === "APPROVED" && t.approvedAt ? (
            <View style={ticketStyles.stamp}>
              <Text style={ticketStyles.stampWord}>APPROVED</Text>
              <Text style={{ fontSize: 7, marginTop: 2 }}>
                {t.approvedByName ?? "Admin"}
              </Text>
              <Text style={{ fontSize: 7 }}>{fmtDt(t.approvedAt)}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: palette.muted }}>Status: {t.status}</Text>
          )}
        </View>

        {/* Field grid */}
        <View style={ticketStyles.fieldGrid}>
          <PdfField label="Broker" value={t.brokerName} />
          <PdfField label="Company hauling for" value={t.companyHaulingFor} />
          <PdfField label="Truck number" value={t.truckNumber} mono />
          <PdfField label="License plate" value={t.licensePlate} mono />
          <PdfField label="Job / contract #" value={t.jobContractNumber} mono />
          <PdfField label="Equipment type" value={t.equipmentLabel} />
          <PdfField label="Pickup location" value={t.pickupLocation} />
          <PdfField label="Delivery location" value={t.deliveryLocation} />
          <PdfField label="407 ETR used" value={t.used407ETR ? "Yes" : "No"} />
          <PdfField
            label="Project"
            value={
              t.projectName
                ? `${t.projectName}${t.projectClient ? ` · ${t.projectClient}` : ""}`
                : null
            }
          />
          <PdfField label="Material type" value={t.materialType} />
        </View>

        {/* Time block */}
        <View style={ticketStyles.timeBlock}>
          <View style={{ alignItems: "center" }}>
            <Text style={ticketStyles.timeLabel}>Start</Text>
            <Text style={ticketStyles.timeValue}>{t.startTime ? fmtTime(t.startTime) : "—"}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={ticketStyles.timeLabel}>End</Text>
            <Text style={ticketStyles.timeValue}>{t.endTime ? fmtTime(t.endTime) : "—"}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={ticketStyles.timeLabel}>Total hours</Text>
            <Text style={ticketStyles.timeValue}>
              {t.totalHours !== null ? t.totalHours.toFixed(2) : "—"}
            </Text>
          </View>
        </View>

        {/* Loads */}
        <Text style={ticketStyles.sectionTitle}>Loads ({t.loadEntries.length})</Text>
        {t.loadEntries.length === 0 ? (
          <Text style={{ fontSize: 9, color: palette.muted, fontStyle: "italic" }}>
            No loads recorded.
          </Text>
        ) : (
          <View>
            <View style={base.row}>
              <Text style={[base.th, { flex: 1 }]}>#</Text>
              <Text style={[base.th, { flex: 2 }]}>Time</Text>
              <Text style={[base.th, { flex: 5 }]}>Notes</Text>
            </View>
            {t.loadEntries.map((e) => (
              <View key={e.loadNumber} style={base.row} wrap={false}>
                <Text style={[base.td, { flex: 1, fontFamily: "Courier" }]}>{e.loadNumber}</Text>
                <Text style={[base.td, { flex: 2 }]}>
                  {e.loadTime ? fmtTime(e.loadTime) : "—"}
                </Text>
                <Text style={[base.td, { flex: 5 }]}>{e.notes ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Comments + issues */}
        {t.issuesNote ? (
          <>
            <Text style={ticketStyles.sectionTitle}>Issues reported</Text>
            <Text style={ticketStyles.flagBox}>{t.issuesNote}</Text>
          </>
        ) : null}
        {t.comments ? (
          <>
            <Text style={ticketStyles.sectionTitle}>Comments</Text>
            <Text style={ticketStyles.notesBox}>{t.comments}</Text>
          </>
        ) : null}

        {/* Photos */}
        {t.photoUrls.length > 0 ? (
          <>
            <Text style={ticketStyles.sectionTitle}>Photos</Text>
            <View style={ticketStyles.photoGrid}>
              {t.photoUrls.slice(0, 9).map((url, i) => (
                <Image key={i} src={url} style={ticketStyles.photoCell} />
              ))}
            </View>
          </>
        ) : null}

        {/* Signature + sign-off */}
        <Text style={ticketStyles.sectionTitle}>Operator signature</Text>
        <View style={ticketStyles.signatureBox}>
          {t.signatureDataUrl ? (
            <Image src={t.signatureDataUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <Text style={{ textAlign: "center", marginTop: 30, color: palette.muted, fontStyle: "italic" }}>
              Not signed
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 8, color: palette.muted, marginTop: 2 }}>
          {t.operatorName}
          {t.operatorEmployeeId ? ` · ${t.operatorEmployeeId}` : ""}
          {t.submittedAt ? ` · submitted ${fmtDt(t.submittedAt)}` : ""}
        </Text>

        {t.status === "FLAGGED" && t.flagReason ? (
          <>
            <Text style={ticketStyles.sectionTitle}>Admin flag</Text>
            <Text style={ticketStyles.flagBox}>
              {t.flaggedByName ?? "Admin"} · {t.flaggedAt ? fmtDt(t.flaggedAt) : ""}
              {"\n"}
              {t.flagReason}
            </Text>
          </>
        ) : null}

        <View style={base.footer} fixed>
          <Text>HK ENV. WEB-APP · {t.ticketNumber}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function PdfField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <View style={ticketStyles.field}>
      <Text style={ticketStyles.fieldLabel}>{label.toUpperCase()}</Text>
      <Text
        style={[
          ticketStyles.fieldValue,
          mono ? { fontFamily: "Courier" } : {},
          !value ? { color: palette.muted, fontStyle: "italic" } : {},
        ]}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

// --- Helpers -------------------------------------------------------------

const fmtDate = (d: Date) =>
  d.toISOString().slice(0, 10);
const fmtTime = (d: Date) => {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const fmtDt = (d: Date) =>
  d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

// --- Response builders ---------------------------------------------------

export async function pdfResponse(
  doc: React.ReactElement<DocumentProps>,
  filename: string,
): Promise<Response> {
  const buf = await renderToBuffer(doc);
  // Copy the bytes into a fresh ArrayBuffer to satisfy Web BlobPart typing
  // (Node's Buffer.buffer is ArrayBufferLike which TS won't widen to plain
  // ArrayBuffer because of SharedArrayBuffer overlap).
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Response(new Blob([ab], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${sanitiseFilename(filename)}"`,
    },
  });
}

// Suppress @react-pdf font-warning noise at first render. Calling this is
// optional but keeps server logs quiet.
let registered = false;
export function ensureFontsRegistered(): void {
  if (registered) return;
  // No custom fonts — Helvetica + Courier are PDF built-ins.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

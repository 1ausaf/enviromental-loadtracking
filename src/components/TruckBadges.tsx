import type { TruckStatus, TruckType } from "@/generated/prisma/client";

const STATUS_STYLES: Record<TruckStatus, { label: string; cls: string }> = {
  ACTIVE: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  },
  MAINTENANCE: {
    label: "Maintenance",
    cls: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  INACTIVE: {
    label: "Inactive",
    cls: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  },
};

const TYPE_LABELS: Record<TruckType, string> = {
  TRI_AXLE: "Tri-Axle",
  END_DUMP: "End Dump",
  LIVE_BOTTOM: "Live Bottom",
  FLOAT: "Float",
};

export function TruckStatusBadge({ status }: { status: TruckStatus }) {
  const { label, cls } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

export function truckTypeLabel(type: TruckType): string {
  return TYPE_LABELS[type];
}

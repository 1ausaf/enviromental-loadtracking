"use client";

import { useActionState } from "react";
import { truckTypeLabel } from "@/components/TruckBadges";
import type { TruckType } from "@/generated/prisma/client";
import {
  createDispatchAction,
  updateDispatchAction,
  type CreateDispatchState,
  type EditDispatchState,
} from "./actions";

const CREATE_INITIAL: CreateDispatchState = { status: "idle" };
const EDIT_INITIAL: EditDispatchState = { status: "idle" };

type ProjectOpt = { id: string; name: string; client: string };
type OperatorOpt = { id: string; name: string; employeeId: string | null; isActive: boolean };
type TruckOpt = { id: string; licensePlate: string; type: TruckType };

type Initial = {
  projectId: string;
  operatorId: string;
  truckId: string;
  scheduledFor: Date;
  pickupNote: string | null;
  dumpNote: string | null;
  notes: string | null;
};

function tomorrow8amLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  // datetime-local expects "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDtLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DispatchForm(
  props:
    | { mode: "create"; projects: ProjectOpt[]; operators: OperatorOpt[]; trucks: TruckOpt[]; id?: undefined; initial?: undefined }
    | { mode: "edit"; id: string; initial: Initial; projects: ProjectOpt[]; operators: OperatorOpt[]; trucks: TruckOpt[] },
) {
  if (props.mode === "create") {
    return <Body {...props} initial={undefined} />;
  }
  return <Body {...props} />;
}

function Body({
  mode,
  id,
  initial,
  projects,
  operators,
  trucks,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: Initial;
  projects: ProjectOpt[];
  operators: OperatorOpt[];
  trucks: TruckOpt[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createDispatchAction,
    CREATE_INITIAL,
  );
  const [editState, editAction, editPending] = useActionState(
    mode === "edit"
      ? updateDispatchAction.bind(null, id ?? "")
      : async () => EDIT_INITIAL,
    EDIT_INITIAL,
  );
  const state = mode === "create" ? createState : editState;
  const action = mode === "create" ? createAction : editAction;
  const pending = mode === "create" ? createPending : editPending;

  const defaultScheduled = initial ? toDtLocal(initial.scheduledFor) : tomorrow8amLocal();

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="projectId" className="mb-1 block text-sm font-medium text-zinc-900">
          Project
        </label>
        <select
          id="projectId"
          name="projectId"
          required
          defaultValue={initial?.projectId ?? ""}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          {!initial ? <option value="">— Pick a project —</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.client}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="operatorId" className="mb-1 block text-sm font-medium text-zinc-900">
            Operator
          </label>
          <select
            id="operatorId"
            name="operatorId"
            required
            defaultValue={initial?.operatorId ?? ""}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            {!initial ? <option value="">— Pick an operator —</option> : null}
            {operators
              .filter((o) => o.isActive || o.id === initial?.operatorId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.employeeId ? ` · ${o.employeeId}` : ""}
                  {o.isActive ? "" : " (inactive)"}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="truckId" className="mb-1 block text-sm font-medium text-zinc-900">
            Truck
          </label>
          <select
            id="truckId"
            name="truckId"
            required
            defaultValue={initial?.truckId ?? ""}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            {!initial ? <option value="">— Pick a truck —</option> : null}
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.licensePlate} ({truckTypeLabel(t.type)})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Only ACTIVE trucks are shown (per §2.3).
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="scheduledFor" className="mb-1 block text-sm font-medium text-zinc-900">
          Scheduled
        </label>
        <input
          id="scheduledFor"
          name="scheduledFor"
          type="datetime-local"
          required
          defaultValue={defaultScheduled}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Defaults to tomorrow at 8 AM — the operator gets it a day in advance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="pickupNote"
          label="Pickup site (optional)"
          defaultValue={initial?.pickupNote ?? ""}
          placeholder="e.g. 1500 Don Mills Rd, gate B"
        />
        <Field
          id="dumpNote"
          label="Dump site (optional)"
          defaultValue={initial?.dumpNote ?? ""}
          placeholder="e.g. Brock Road landfill"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-zinc-900">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder="Anything the driver needs to know — gate codes, hours, etc."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
      {state.status === "saved" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Saved.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create dispatch" : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

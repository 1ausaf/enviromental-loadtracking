"use client";

import { useActionState } from "react";
import type { ProjectStatus } from "@/generated/prisma/client";
import {
  createProjectAction,
  updateProjectAction,
  type CreateProjectState,
  type EditProjectState,
} from "./actions";

const CREATE_INITIAL: CreateProjectState = { status: "idle" };
const EDIT_INITIAL: EditProjectState = { status: "idle" };

type Initial = {
  name: string;
  client: string;
  address: string;
  startDate: Date;
  endDate: Date | null;
  materialBudget: number;
  loadTarget: number;
  scheduleNotes: string | null;
  status: ProjectStatus;
};

function isoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function ProjectForm(
  props: { mode: "create"; initial?: undefined; id?: undefined } | { mode: "edit"; id: string; initial: Initial },
) {
  if (props.mode === "create") {
    return <CreateForm />;
  }
  return <EditForm id={props.id} initial={props.initial} />;
}

function CreateForm() {
  const [state, action, pending] = useActionState(createProjectAction, CREATE_INITIAL);
  return (
    <FormBody
      state={state}
      action={action}
      pending={pending}
      label={pending ? "Creating…" : "Create project"}
    />
  );
}

function EditForm({ id, initial }: { id: string; initial: Initial }) {
  const [state, action, pending] = useActionState(
    updateProjectAction.bind(null, id),
    EDIT_INITIAL,
  );
  return (
    <FormBody
      state={state}
      action={action}
      pending={pending}
      initial={initial}
      label={pending ? "Saving…" : "Save changes"}
    />
  );
}

type AnyState = CreateProjectState | EditProjectState;

function FormBody({
  state,
  action,
  pending,
  initial,
  label,
}: {
  state: AnyState;
  action: (formData: FormData) => void;
  pending: boolean;
  initial?: Initial;
  label: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="name" label="Project name" defaultValue={initial?.name} required autoFocus={!initial} />
        <Field id="client" label="Client" defaultValue={initial?.client} required />
        <div className="sm:col-span-2">
          <Field id="address" label="Site address" defaultValue={initial?.address} required />
        </div>
        <DateField id="startDate" label="Start date" defaultValue={isoDate(initial?.startDate ?? null)} required />
        <DateField id="endDate" label="End date (optional)" defaultValue={isoDate(initial?.endDate ?? null)} />
        <Field
          id="materialBudget"
          label="Material budget (CAD)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initial?.materialBudget !== undefined ? String(initial.materialBudget) : ""}
          required
        />
        <Field
          id="loadTarget"
          label="Load target"
          type="number"
          step="1"
          min="0"
          defaultValue={initial?.loadTarget !== undefined ? String(initial.loadTarget) : ""}
          required
        />
        <div className="sm:col-span-2">
          <label htmlFor="scheduleNotes" className="mb-1 block text-sm font-medium text-zinc-900">
            Schedule notes
          </label>
          <textarea
            id="scheduleNotes"
            name="scheduleNotes"
            defaultValue={initial?.scheduleNotes ?? ""}
            rows={3}
            placeholder="e.g. Mon–Fri, 6 AM start, 3 trucks/day…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-zinc-900">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "ACTIVE"}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
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
        {label}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  defaultValue,
  required,
  autoFocus,
  step,
  min,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoFocus?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        step={step}
        min={min}
        defaultValue={defaultValue}
        required={required}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

function DateField({
  id,
  label,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return <Field id={id} label={label} type="date" defaultValue={defaultValue} required={required} />;
}

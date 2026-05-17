"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TruckType } from "@/generated/prisma/client";
import { SignaturePad } from "@/components/SignaturePad";
import {
  deleteDraftAction,
  saveDraftAction,
  signAndSubmitAction,
  type EditTicketState,
} from "../actions";

const INITIAL: EditTicketState = { status: "idle" };

type LoadRow = { loadNumber: number; loadTime: string; notes: string };

type Initial = {
  date: string;
  brokerName: string;
  truckNumber: string;
  licensePlate: string;
  companyHaulingFor: string;
  jobContractNumber: string;
  pickupLocation: string;
  deliveryLocation: string;
  equipmentType: TruckType;
  used407ETR: boolean;
  startTime: string;
  endTime: string;
  comments: string;
  loadEntries: LoadRow[];
};

export function DraftEditor({ id, initial }: { id: string; initial: Initial }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, savePending] = useActionState(
    saveDraftAction.bind(null, id),
    INITIAL,
  );
  const [loads, setLoads] = useState<LoadRow[]>(
    initial.loadEntries.length > 0 ? initial.loadEntries : [],
  );
  const [signature, setSignature] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [removing, startRemove] = useTransition();

  function addLoad() {
    const nextNum = loads.length === 0 ? 1 : Math.max(...loads.map((l) => l.loadNumber)) + 1;
    setLoads([...loads, { loadNumber: nextNum, loadTime: "", notes: "" }]);
  }
  function removeLoad(i: number) {
    setLoads(loads.filter((_, idx) => idx !== i));
  }
  function setLoadField(i: number, key: keyof LoadRow, val: string | number) {
    const next = [...loads];
    // @ts-expect-error narrow union
    next[i][key] = val;
    setLoads(next);
  }

  async function saveAndSubmit() {
    if (!signature) {
      setSubmitError("Sign in the box below before submitting.");
      return;
    }
    setSubmitError(null);
    // Save first (using the form action so all fields persist), then submit.
    if (formRef.current) {
      formRef.current.requestSubmit();
      // Wait one tick to let the save kick off — the user-visible "Saving"
      // pill comes from useActionState's pending state above. We rely on the
      // server to be idempotent: it's fine to call signAndSubmit immediately,
      // because the save action will run before our network call returns.
    }
    startSubmit(async () => {
      // Give the save action a beat — server actions are serialized per page.
      await new Promise((r) => setTimeout(r, 100));
      const res = await signAndSubmitAction(id, signature);
      if (res.error) {
        setSubmitError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  async function remove() {
    if (!confirm("Delete this draft? Once you submit a ticket it's archived permanently.")) return;
    startRemove(async () => {
      const res = await deleteDraftAction(id);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="space-y-6">
        {/* Hidden encoded load entries so the server action picks them up */}
        <input
          type="hidden"
          name="loadEntriesJson"
          value={JSON.stringify(
            loads.map((l) => ({
              loadNumber: l.loadNumber,
              loadTime: l.loadTime || null,
              notes: l.notes || null,
            })),
          )}
        />

        <Section title="Ticket details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="date" label="Date" type="date" defaultValue={initial.date} required />
            <Select id="equipmentType" label="Equipment" defaultValue={initial.equipmentType} options={EQ_OPTIONS} />
            <Input id="brokerName" label="Broker" defaultValue={initial.brokerName} />
            <Input id="companyHaulingFor" label="Company hauling for" defaultValue={initial.companyHaulingFor} />
            <Input id="truckNumber" label="Truck number" defaultValue={initial.truckNumber} />
            <Input id="licensePlate" label="License plate" defaultValue={initial.licensePlate} />
            <Input id="jobContractNumber" label="Job / contract #" defaultValue={initial.jobContractNumber} />
            <Checkbox id="used407ETR" label="407 ETR used" defaultChecked={initial.used407ETR} />
          </div>
        </Section>

        <Section title="Sites">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="pickupLocation" label="Pickup location" defaultValue={initial.pickupLocation} />
            <Input id="deliveryLocation" label="Delivery location" defaultValue={initial.deliveryLocation} />
          </div>
        </Section>

        <Section title="Times">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input id="startTime" label="Start time" type="datetime-local" defaultValue={initial.startTime} required />
            <Input id="endTime" label="End time" type="datetime-local" defaultValue={initial.endTime} required />
            <div className="flex flex-col">
              <span className="mb-1 block text-sm font-medium text-zinc-900">Total hours</span>
              <span className="text-xs italic text-zinc-500">
                Computed on submit (end &minus; start).
              </span>
            </div>
          </div>
        </Section>

        <Section title="Loads">
          <ul className="space-y-2">
            {loads.length === 0 ? (
              <li className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-500">
                No loads yet. Add one for each trip you make.
              </li>
            ) : null}
            {loads.map((l, i) => (
              <li key={i} className="grid grid-cols-12 gap-2">
                <input
                  type="number"
                  min={1}
                  value={l.loadNumber}
                  onChange={(e) => setLoadField(i, "loadNumber", Number(e.target.value))}
                  className="col-span-2 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  aria-label={`Load ${i + 1} number`}
                />
                <input
                  type="datetime-local"
                  value={l.loadTime}
                  onChange={(e) => setLoadField(i, "loadTime", e.target.value)}
                  className="col-span-5 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  aria-label={`Load ${i + 1} time`}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={l.notes}
                  onChange={(e) => setLoadField(i, "notes", e.target.value)}
                  className="col-span-4 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => removeLoad(i)}
                  className="col-span-1 rounded-md border border-zinc-300 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                  aria-label={`Remove load ${l.loadNumber}`}
                >
                  &minus;
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addLoad}
            className="mt-3 inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Add load
          </button>
        </Section>

        <Section title="Comments">
          <textarea
            id="comments"
            name="comments"
            rows={3}
            defaultValue={initial.comments}
            placeholder="Anything the admin should know."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </Section>

        {state.status === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </div>
        ) : null}
        {state.status === "saved" ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Draft saved.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={savePending}
            className="inline-flex h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
          >
            {savePending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className="inline-flex h-11 items-center rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {removing ? "Deleting…" : "Discard draft"}
          </button>
        </div>
      </form>

      <Section title="Sign & submit">
        <p className="text-xs text-zinc-500">
          By signing, you confirm the ticket is accurate. Once submitted it
          can&apos;t be edited or deleted — it&apos;s archived permanently per
          proposal §2.2.
        </p>
        <SignaturePad onChange={setSignature} className="mt-3" />
        {submitError ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </div>
        ) : null}
        <button
          type="button"
          onClick={saveAndSubmit}
          disabled={!signature || submitting || savePending}
          className="mt-3 inline-flex h-12 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Sign & submit"}
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Input({
  id,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
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
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

function Select({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({
  id,
  label,
  defaultChecked,
}: {
  id: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-end">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
        <input
          id={id}
          name={id}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        {label}
      </label>
    </div>
  );
}

const EQ_OPTIONS = [
  { value: "TRI_AXLE", label: "Tri-Axle" },
  { value: "END_DUMP", label: "End Dump" },
  { value: "LIVE_BOTTOM", label: "Live Bottom" },
  { value: "FLOAT", label: "Float" },
];

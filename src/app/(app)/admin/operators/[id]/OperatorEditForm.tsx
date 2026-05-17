"use client";

import { useActionState } from "react";
import type { LicenceClass } from "@/generated/prisma/client";
import { updateOperatorAction, type EditOperatorState } from "../actions";

const INITIAL: EditOperatorState = { status: "idle" };

export function OperatorEditForm({
  id,
  initial,
}: {
  id: string;
  initial: { phone: string | null; licenceClass: LicenceClass | null };
}) {
  const [state, action, pending] = useActionState(
    updateOperatorAction.bind(null, id),
    INITIAL,
  );
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-900">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial.phone ?? ""}
            placeholder="(416) 555-0100"
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <div>
          <label htmlFor="licenceClass" className="mb-1 block text-sm font-medium text-zinc-900">
            Licence class
          </label>
          <select
            id="licenceClass"
            name="licenceClass"
            defaultValue={initial.licenceClass ?? ""}
            className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">— Not on file —</option>
            <option value="AZ">AZ</option>
            <option value="DZ">DZ</option>
            <option value="BZ">BZ</option>
            <option value="CZ">CZ</option>
            <option value="G">G</option>
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
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

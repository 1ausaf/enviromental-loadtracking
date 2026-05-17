"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { hasAccess, type Role } from "@/lib/roles";
import { createUserAction, type CreateState } from "../actions";

const INITIAL: CreateState = { status: "idle" };

export function NewUserForm({ actorRole }: { actorRole: Role }) {
  const [state, action, pending] = useActionState(createUserAction, INITIAL);
  const [copied, setCopied] = useState(false);

  if (state.status === "success") {
    const { user, tempPassword } = state.result;
    return (
      <div className="space-y-5">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong className="font-semibold">User created.</strong>{" "}
          {user.name} is now {user.role} with employee ID{" "}
          <code className="rounded bg-white px-1 font-mono">{user.employeeId}</code>.
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-zinc-900">
            Temporary password — shown only once
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm">
              {tempPassword}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(tempPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Share this with {user.name} through a secure channel. They&apos;ll be
            asked to set up 2FA on first sign-in, and should change this
            password via &quot;Forgot password&quot;.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Back to users
          </Link>
          <Link
            href="/admin/users/new"
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add another
          </Link>
        </div>
      </div>
    );
  }

  // Admins can create Admins + Operators; only Owners can create Owners.
  const canCreateOwner = hasAccess("OWNER", actorRole);

  return (
    <form action={action} className="space-y-4">
      <Field id="name" label="Name" type="text" autoComplete="name" required autoFocus />
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <div>
        <label htmlFor="role" className="mb-1 block text-sm font-medium text-zinc-900">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="OPERATOR"
          required
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          <option value="OPERATOR">Operator — drivers in the field</option>
          <option value="ADMIN">Admin — dispatch, tickets, projects</option>
          {canCreateOwner ? (
            <option value="OWNER">Owner — full access incl. exception approvals</option>
          ) : null}
        </select>
      </div>
      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  required,
  autoFocus,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
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
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

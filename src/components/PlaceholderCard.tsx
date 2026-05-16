import type { ReactNode } from "react";

export function PlaceholderCard({
  title,
  phase,
  proposalSection,
  children,
}: {
  title: string;
  phase: string;
  proposalSection: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
          {phase}
        </span>
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Proposal {proposalSection}
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {title}
      </h1>
      {children ? <div className="mt-4 text-zinc-700">{children}</div> : null}
      <p className="mt-6 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
        Placeholder screen. The build plan delivers this in {phase}.
      </p>
    </div>
  );
}

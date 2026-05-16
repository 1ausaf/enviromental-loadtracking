import { getCurrentUser } from "@/lib/session";
import { RoleBadge } from "@/components/RoleBadge";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Welcome, {user.name}
          </h1>
          <RoleBadge role={user.role} />
        </div>
        <p className="mt-2 text-zinc-600">
          HK ENV. WEB-APP &mdash; Phase 0 foundation. Modules listed below ship
          phase by phase per the build plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div
            key={m.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
              <span>{m.phase}</span>
              <span>&middot;</span>
              <span>{m.section}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-zinc-900">
              {m.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{m.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MODULES = [
  {
    phase: "Phase 1",
    section: "Proposal 2.1",
    title: "Authentication & login",
    summary: "Email + password, password reset, 2FA via authenticator app, login/logout location capture.",
  },
  {
    phase: "Phase 2",
    section: "Proposal 2.1",
    title: "User & role management",
    summary: "Fast user creation, employee IDs, deactivation preserves history.",
  },
  {
    phase: "Phase 3",
    section: "Proposal 2.3",
    title: "Truck & driver management",
    summary: "Truck profiles, operator assignment, status flags, per-truck/operator stats.",
  },
  {
    phase: "Phase 4",
    section: "Proposal 2.4",
    title: "Projects & dashboards",
    summary: "Project creation with budget, live progress bars, master admin dashboard, document vault.",
  },
  {
    phase: "Phase 5",
    section: "Proposal 2.6",
    title: "Dispatch system",
    summary: "Day-ahead dispatch with operator accept/flag, real-time status board.",
  },
  {
    phase: "Phase 6",
    section: "Proposal 2.5",
    title: "GPS & location history",
    summary: "Browser GPS trip tracking, full route replay, searchable history.",
  },
  {
    phase: "Phase 7",
    section: "Proposal 2.2",
    title: "Digital load ticketing",
    summary: "Fillable digital ticket mirroring HK's paper form, e-signature, admin approval.",
  },
  {
    phase: "Phase 8",
    section: "Proposal 2.7",
    title: "End-of-haul & arrival alerts",
    summary: "Auto-prefilled tickets from trip data, live arrival countdown on admin dashboard.",
  },
  {
    phase: "Phase 9",
    section: "Proposal 2.8",
    title: "Owner exception approvals",
    summary: "Out-of-rule items escalated to Owner with decision audit trail.",
  },
  {
    phase: "Phase 10",
    section: "Proposal 2.7",
    title: "Reports & exports",
    summary: "PDF and CSV export across tickets, trips, projects, operator/truck stats.",
  },
  {
    phase: "Phase 11",
    section: "Proposal 3",
    title: "QA & demo prep",
    summary: "Seed data, end-to-end walkthrough, mobile polish.",
  },
];

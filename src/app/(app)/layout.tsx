import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RoleBadge } from "@/components/RoleBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/session";
import { hasAccess } from "@/lib/roles";
import { countPendingExceptions } from "@/lib/exceptions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Only admins+ care about the badge — hide the query for operators.
  const pendingExceptions = hasAccess("ADMIN", user.role)
    ? await countPendingExceptions()
    : 0;

  return (
    <div
      data-app-role={user.role}
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900"
    >
      <header className="relative border-b border-slate-200 bg-white print:hidden">
        {/* Thin brand accent bar — keeps the chrome calm but visually anchored */}
        <div className="h-1 w-full bg-gradient-to-r from-teal-700 via-teal-500 to-emerald-500" />
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={hasAccess("ADMIN", user.role) ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded bg-teal-700" aria-hidden />
            <span className="font-semibold tracking-tight text-slate-900">
              HK ENV.
            </span>
          </Link>

          <div className="flex-1" />

          <Nav role={user.role} pendingExceptions={pendingExceptions} />

          <div className="hidden items-center gap-3 lg:flex">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <RoleBadge role={user.role} />
            <SignOutButton />
          </div>
        </div>
        {/* Mobile: user info + sign out under the hamburger menu */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <RoleBadge role={user.role} />
            <span className="truncate text-xs text-slate-600">{user.name}</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
          HK ENV. WEB-APP
        </div>
      </footer>
    </div>
  );
}

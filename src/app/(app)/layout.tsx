import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RoleBadge } from "@/components/RoleBadge";
import { getCurrentUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded bg-teal-600" aria-hidden />
            <span className="font-semibold tracking-tight text-zinc-900">
              HK ENV.
            </span>
          </Link>

          <div className="flex-1" />

          <Nav role={user.role} />

          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium text-zinc-900">{user.name}</div>
              <div className="text-xs text-zinc-500">{user.email}</div>
            </div>
            <RoleBadge role={user.role} />
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
          HK ENV. WEB-APP &middot; Phase 0 foundation
        </div>
      </footer>
    </div>
  );
}

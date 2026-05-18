"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/roles";

type Leaf = {
  kind: "link";
  href: string;
  label: string;
};

type Group = {
  kind: "group";
  label: string;
  items: Leaf[];
};

type NavEntry = (Leaf | Group) & { visibleFor: Role[] };

// Hand-crafted role-specific nav. We deliberately don't use the hasAccess
// hierarchy here because "My dispatches" / "My tickets" are personal-operator
// screens — Admins/Owners shouldn't see them in their top bar even though
// they technically have read access via requireUser("OPERATOR").
const NAV: NavEntry[] = [
  // --- Operator ---
  { kind: "link", visibleFor: ["OPERATOR"], href: "/dashboard", label: "Today" },
  { kind: "link", visibleFor: ["OPERATOR"], href: "/operator", label: "My dispatches" },
  { kind: "link", visibleFor: ["OPERATOR"], href: "/operator/tickets", label: "My tickets" },

  // --- Admin / Owner ---
  { kind: "link", visibleFor: ["ADMIN", "OWNER"], href: "/admin", label: "Dashboard" },
  {
    kind: "group", visibleFor: ["ADMIN", "OWNER"], label: "Operations",
    items: [
      { kind: "link", href: "/admin/dispatch", label: "Dispatch board" },
      { kind: "link", href: "/admin/gps", label: "GPS history" },
    ],
  },
  {
    kind: "group", visibleFor: ["ADMIN", "OWNER"], label: "Tickets",
    items: [
      { kind: "link", href: "/admin/tickets", label: "Review queue" },
      { kind: "link", href: "/owner", label: "Exceptions" },
    ],
  },
  { kind: "link", visibleFor: ["ADMIN", "OWNER"], href: "/admin/projects", label: "Projects" },
  {
    kind: "group", visibleFor: ["ADMIN", "OWNER"], label: "Fleet",
    items: [
      { kind: "link", href: "/admin/trucks", label: "Trucks" },
      { kind: "link", href: "/admin/operators", label: "Drivers" },
    ],
  },
  { kind: "link", visibleFor: ["ADMIN", "OWNER"], href: "/admin/users", label: "Users" },
];

export function Nav({ role, pendingExceptions = 0 }: { role: Role; pendingExceptions?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer

  const visible = NAV.filter((n) => n.visibleFor.includes(role));

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 lg:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Desktop top-bar nav */}
      <nav className="hidden items-center gap-1 lg:flex">
        {visible.map((n, i) =>
          n.kind === "link" ? (
            <DesktopLink key={i} href={n.href} label={n.label} pathname={pathname} badge={n.href === "/owner" ? pendingExceptions : 0} />
          ) : (
            <DesktopGroup key={i} label={n.label} items={n.items} pathname={pathname} pendingExceptions={pendingExceptions} />
          ),
        )}
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div
          className="absolute inset-x-0 top-full z-20 border-b border-zinc-200 bg-white shadow-md lg:hidden"
          onClick={(e) => {
            // dismiss when tapping a link
            if ((e.target as HTMLElement).tagName === "A") setOpen(false);
          }}
        >
          <nav className="flex flex-col p-2">
            {visible.map((n, i) =>
              n.kind === "link" ? (
                <MobileLink key={i} href={n.href} label={n.label} pathname={pathname} badge={n.href === "/owner" ? pendingExceptions : 0} />
              ) : (
                <div key={i} className="mt-2 first:mt-0">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {n.label}
                  </div>
                  {n.items.map((it) => (
                    <MobileLink
                      key={it.href}
                      href={it.href}
                      label={it.label}
                      pathname={pathname}
                      badge={it.href === "/owner" ? pendingExceptions : 0}
                      indent
                    />
                  ))}
                </div>
              ),
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function active(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return pathname === "/admin"; // exact, otherwise every /admin/* matches
  if (href === "/dashboard" || href === "/owner" || href === "/admin/users") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopLink({
  href,
  label,
  pathname,
  badge = 0,
}: {
  href: string;
  label: string;
  pathname: string;
  badge?: number;
}) {
  const isActive = active(pathname, href);
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? "bg-teal-700 text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {label}
      {badge > 0 ? (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
          isActive ? "bg-white text-teal-800" : "bg-amber-500 text-white"
        }`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function DesktopGroup({
  label,
  items,
  pathname,
  pendingExceptions,
}: {
  label: string;
  items: Leaf[];
  pathname: string;
  pendingExceptions: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = items.some((i) => active(pathname, i.href));
  const groupBadge = items.some((i) => i.href === "/owner") ? pendingExceptions : 0;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Close dropdown when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          groupActive ? "bg-teal-700 text-white" : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        {label}
        {groupBadge > 0 ? (
          <span className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
            groupActive ? "bg-white text-teal-800" : "bg-amber-500 text-white"
          }`}>
            {groupBadge}
          </span>
        ) : null}
        <svg className="ml-0.5 h-3 w-3 opacity-70" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-md border border-zinc-200 bg-white shadow-lg">
          {items.map((it) => {
            const isActive = active(pathname, it.href);
            const badge = it.href === "/owner" ? pendingExceptions : 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm first:rounded-t-md last:rounded-b-md ${
                  isActive
                    ? "bg-teal-50 text-teal-900 font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {it.label}
                {badge > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MobileLink({
  href,
  label,
  pathname,
  badge = 0,
  indent = false,
}: {
  href: string;
  label: string;
  pathname: string;
  badge?: number;
  indent?: boolean;
}) {
  const isActive = active(pathname, href);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
        indent ? "pl-6" : ""
      } ${
        isActive ? "bg-teal-700 text-white" : "text-zinc-800 hover:bg-zinc-100"
      }`}
    >
      <span>{label}</span>
      {badge > 0 ? (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
          isActive ? "bg-white text-teal-800" : "bg-amber-500 text-white"
        }`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

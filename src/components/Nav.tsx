"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { hasAccess, type Role } from "@/lib/roles";

type NavItem = {
  href: string;
  label: string;
  required: Role;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", required: "OPERATOR" },
  { href: "/operator", label: "My dispatches", required: "OPERATOR" },
  { href: "/operator/tickets", label: "My tickets", required: "OPERATOR" },
  { href: "/admin", label: "Admin", required: "ADMIN" },
  { href: "/admin/tickets", label: "Tickets", required: "ADMIN" },
  { href: "/admin/dispatch", label: "Dispatch", required: "ADMIN" },
  { href: "/admin/gps", label: "GPS", required: "ADMIN" },
  { href: "/admin/projects", label: "Projects", required: "ADMIN" },
  { href: "/admin/users", label: "Users", required: "ADMIN" },
  { href: "/admin/trucks", label: "Trucks", required: "ADMIN" },
  { href: "/admin/operators", label: "Drivers", required: "ADMIN" },
  { href: "/owner", label: "Exceptions", required: "ADMIN" },
];

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = ITEMS.filter((item) => hasAccess(item.required, role));

  return (
    <>
      <button
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 sm:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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

      <nav className="hidden items-center gap-1 sm:flex">
        {visible.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 border-b border-zinc-200 bg-white shadow-md sm:hidden">
          <nav className="flex flex-col p-2">
            {visible.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                block
              />
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  block = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  block?: boolean;
}) {
  const active =
    pathname === item.href ||
    (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`${block ? "block" : ""} rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {item.label}
    </Link>
  );
}

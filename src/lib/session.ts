import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasAccess, type Role } from "@/lib/roles";
import type { SessionUser } from "@/lib/session-types";

export type { SessionUser };

// Returns the authenticated user or null. Used inside layouts/pages that need
// to render even when logged out (e.g. /login itself doesn't call this).
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

// Hard guard for protected pages. Redirects to /login when no session exists,
// and to /dashboard when the role is insufficient.
export async function requireUser(minRole: Role = "OPERATOR"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAccess(minRole, user.role)) redirect("/dashboard");
  return user;
}

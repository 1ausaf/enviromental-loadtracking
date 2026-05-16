import { isRole, type Role } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// PHASE 0 STUB.
// Real authentication (NextAuth.js / Auth.js + 2FA) lands in Phase 1.
// Until then, getCurrentUser() returns a hardcoded fake user whose role
// can be flipped via the DEV_STUB_ROLE env var so the role-aware shell
// can be demonstrated. Replace the body of this function in Phase 1.
export async function getCurrentUser(): Promise<SessionUser> {
  const stub = process.env.DEV_STUB_ROLE;
  const role: Role = isRole(stub) ? stub : "OWNER";

  return {
    id: "stub-user-id",
    name: "Stub User",
    email: "stub@hkenv.local",
    role,
  };
}

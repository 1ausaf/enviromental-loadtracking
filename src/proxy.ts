import { NextResponse, type NextRequest } from "next/server";

// PHASE 0 STUB.
// Next.js 16 renamed `middleware` to `proxy` — same mechanism. This file is
// the entry point for request-level routing logic.
//
// In Phase 0 there is no real session, so this proxy is a no-op pass-through
// that runs only on protected app routes. Phase 1 replaces the body with a
// real session check (cookie or JWT) and a redirect to /login when missing.
// Per-page role gating (e.g. /admin, /owner) is handled inside the page
// components via getCurrentUser() + hasAccess() — see src/app/(app)/.

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/owner/:path*", "/operator/:path*"],
};

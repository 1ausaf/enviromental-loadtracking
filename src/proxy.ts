import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed `middleware` to `proxy`. Same mechanism.
//
// Optimistic auth check only: if the session cookie is missing, bounce to
// /login before the page even renders. Page-level guards in
// src/lib/session.ts#requireUser do the real session validation against the
// database (the proxy runs on the Edge runtime and cannot use the Prisma
// Node driver). See https://pris.ly/d/edge-runtime.

const SESSION_COOKIE = "hkenv_session";

export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.get(SESSION_COOKIE);
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/owner/:path*", "/operator/:path*"],
};

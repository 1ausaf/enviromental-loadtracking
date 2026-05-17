import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { generateOpaqueToken, sha256 } from "@/lib/tokens";
import type { SessionUser } from "@/lib/session-types";
import { isRole } from "@/lib/roles";

const SESSION_COOKIE = "hkenv_session";
const SESSION_TTL_DAYS = 7;

export type GeoCapture = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationError: string | null;
};

// Create a Session row, write the cookie, and log a LOGIN SessionEvent
// (with browser-captured GPS if available).
export async function startSession(
  userId: string,
  geo: GeoCapture,
): Promise<{ sessionId: string }> {
  const raw = generateOpaqueToken();
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { ua, ip } = await readRequestContext();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: ua,
      ipAddress: ip,
    },
  });

  await prisma.sessionEvent.create({
    data: {
      userId,
      sessionId: session.id,
      type: "LOGIN",
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracyMeters: geo.accuracyMeters,
      locationError: geo.locationError,
      userAgent: ua,
      ipAddress: ip,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { sessionId: session.id };
}

// Revoke the current session, clear the cookie, log a LOGOUT SessionEvent.
export async function endSession(geo: GeoCapture): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return;

  const tokenHash = sha256(raw);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (session && !session.revokedAt) {
    const { ua, ip } = await readRequestContext();
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await prisma.sessionEvent.create({
      data: {
        userId: session.userId,
        sessionId: session.id,
        type: "LOGOUT",
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracyMeters: geo.accuracyMeters,
        locationError: geo.locationError,
        userAgent: ua,
        ipAddress: ip,
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

// Look up the current session via the cookie. Returns null when missing,
// expired, or revoked.
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const tokenHash = sha256(raw);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  if (!isRole(session.user.role)) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

async function readRequestContext(): Promise<{ ua: string | null; ip: string | null }> {
  const h = await headers();
  const ua = h.get("user-agent") ?? null;
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : (h.get("x-real-ip") ?? null);
  return { ua, ip };
}

export { SESSION_COOKIE };

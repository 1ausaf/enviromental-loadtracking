import crypto from "node:crypto";
import { cookies } from "next/headers";

// During the multi-step login (password OK → awaiting TOTP), we carry the
// pending userId in an HMAC-signed, HTTP-only cookie that expires in 5 minutes.
// No DB row needed; the secret prevents tampering.

const COOKIE = "hkenv_pending";
const TTL_MS = 5 * 60 * 1000;

type Payload = {
  userId: string;
  // 'setup' = first-time 2FA setup needed; 'verify' = totpEnabled already
  stage: "setup" | "verify";
  exp: number;
};

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need 32+ chars). " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return s;
}

function sign(payload: Payload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const mac = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

function verify(token: string): Payload | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const body = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.userId !== "string") return null;
    if (payload.stage !== "setup" && payload.stage !== "verify") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setPendingLogin(
  userId: string,
  stage: "setup" | "verify",
): Promise<void> {
  const token = sign({ userId, stage, exp: Date.now() + TTL_MS });
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function readPendingLogin(): Promise<Payload | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  return verify(raw);
}

export async function clearPendingLogin(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

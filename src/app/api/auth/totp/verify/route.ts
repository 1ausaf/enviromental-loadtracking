import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { parseGeo } from "@/lib/geo";
import { clearPendingLogin, readPendingLogin } from "@/lib/pending-login";
import { verifyTotp } from "@/lib/totp";

// Final step of login. Body: { code, geo? }.
// - "setup" stage: also flips totpEnabled=true on success.
// - "verify" stage: just verifies the code.
// On success, opens a Session (with browser-captured GPS).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const geo = parseGeo(body?.geo);

  const pending = await readPendingLogin();
  if (!pending) {
    return NextResponse.json(
      { error: "No pending login. Start at /login." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: {
      id: true,
      isActive: true,
      totpSecret: true,
      totpEnabled: true,
    },
  });
  if (!user || !user.isActive || !user.totpSecret) {
    return NextResponse.json({ error: "Account not available." }, { status: 401 });
  }

  if (!verifyTotp(code, user.totpSecret)) {
    return NextResponse.json({ error: "Invalid 2FA code." }, { status: 401 });
  }

  if (pending.stage === "setup" && !user.totpEnabled) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    });
  }

  await startSession(user.id, geo);
  await clearPendingLogin();

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readPendingLogin } from "@/lib/pending-login";
import { buildOtpAuthUrl, buildQrDataUrl, generateTotpSecret } from "@/lib/totp";

// Called by the /login/2fa-setup page after a fresh password-step success
// when the user does not yet have 2FA enabled.
//
// Generates a fresh TOTP secret, stores it on the user (still totpEnabled=false
// until they verify), and returns the QR data URL the page renders.
export async function POST() {
  const pending = await readPendingLogin();
  if (!pending || pending.stage !== "setup") {
    return NextResponse.json(
      { error: "No pending 2FA setup. Start at /login." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { id: true, email: true, totpEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 401 });
  if (user.totpEnabled) {
    return NextResponse.json(
      { error: "2FA already enabled on this account." },
      { status: 409 },
    );
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret },
  });

  const otpAuthUrl = buildOtpAuthUrl(secret, user.email);
  const qrDataUrl = await buildQrDataUrl(otpAuthUrl);

  return NextResponse.json({ qrDataUrl, otpAuthUrl, secret });
}

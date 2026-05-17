import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { sha256 } from "@/lib/tokens";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token || !newPassword) {
    return NextResponse.json(
      { error: "Token and new password are required." },
      { status: 400 },
    );
  }

  const strength = validatePasswordStrength(newPassword);
  if (strength) return NextResponse.json({ error: strength }, { status: 400 });

  const tokenHash = sha256(token);
  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        // Force fresh 2FA setup on next login so a leaked TOTP secret
        // cannot ride alongside a password change.
        totpEnabled: false,
        totpSecret: null,
      },
    }),
    prisma.passwordReset.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
    // Revoke every existing session — password just changed.
    prisma.session.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

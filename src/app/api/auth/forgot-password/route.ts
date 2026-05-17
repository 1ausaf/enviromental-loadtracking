import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { generateOpaqueToken, sha256 } from "@/lib/tokens";

const TTL_MINUTES = 30;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  // Always return success — never leak whether an account exists.
  if (!email) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });

  if (user && user.isActive) {
    const raw = generateOpaqueToken();
    const tokenHash = sha256(raw);
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

    // Invalidate any prior unused tokens so only the latest link works.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const base =
      process.env.AUTH_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`;
    const resetUrl = `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(raw)}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  return NextResponse.json({ ok: true });
}

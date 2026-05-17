import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setPendingLogin } from "@/lib/pending-login";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      totpEnabled: true,
      isActive: true,
    },
  });

  // Constant-ish failure: never reveal whether the email exists.
  if (!user || !user.isActive) {
    // Burn cycles to roughly match the bcrypt compare cost.
    await verifyPassword(password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidu");
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  // Password OK — issue the short-lived pending-login cookie and tell the
  // client which step is next.
  const stage: "setup" | "verify" = user.totpEnabled ? "verify" : "setup";
  await setPendingLogin(user.id, stage);

  return NextResponse.json({ ok: true, stage });
}

import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { parseGeo } from "@/lib/geo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const geo = parseGeo(body?.geo);
  await endSession(geo);
  return NextResponse.json({ ok: true });
}

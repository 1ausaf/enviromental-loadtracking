import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appendPoints, TripError, type GpsPoint } from "@/lib/trips";

export const runtime = "nodejs";

type RawPoint = {
  recordedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireUser("OPERATOR");
  const { id: tripId } = await params;

  const op = await prisma.operator.findUnique({ where: { userId: actor.id } });
  if (!op) {
    return NextResponse.json({ error: "Only operators can post samples." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { points?: RawPoint[] } | null;
  if (!body || !Array.isArray(body.points)) {
    return NextResponse.json({ error: "Body must be { points: [...] }." }, { status: 400 });
  }

  const points: GpsPoint[] = [];
  for (const p of body.points) {
    if (
      typeof p?.latitude !== "number" ||
      typeof p?.longitude !== "number" ||
      typeof p?.recordedAt !== "string"
    )
      continue;
    const recordedAt = new Date(p.recordedAt);
    if (isNaN(recordedAt.getTime())) continue;
    points.push({
      recordedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: typeof p.accuracy === "number" ? p.accuracy : null,
      speed: typeof p.speed === "number" ? p.speed : null,
      heading: typeof p.heading === "number" ? p.heading : null,
    });
  }

  try {
    const r = await appendPoints(tripId, op.id, points);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof TripError) {
      const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: "Failed to record samples." }, { status: 500 });
  }
}

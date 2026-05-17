import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { addTicketPhoto, TicketError } from "@/lib/tickets";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireUser("OPERATOR");
  const op = await prisma.operator.findUnique({ where: { userId: actor.id } });
  if (!op) {
    return NextResponse.json({ error: "Only operators can upload photos." }, { status: 403 });
  }
  const { id: ticketId } = await params;

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'photo' file." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const photo = await addTicketPhoto(
      op.id,
      ticketId,
      buf,
      file.name || "photo",
      file.type || "application/octet-stream",
    );
    return NextResponse.json({
      id: photo.id,
      filename: photo.filename,
      originalName: photo.originalName,
      byteSize: photo.byteSize,
    });
  } catch (e) {
    if (e instanceof TicketError) {
      const status =
        e.code === "FORBIDDEN" ? 403 :
        e.code === "NOT_FOUND" ? 404 :
        e.code === "INVALID_STATE" ? 409 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

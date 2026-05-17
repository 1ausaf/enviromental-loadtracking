import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ProjectError, uploadDocument } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireUser("ADMIN");
  const { id: projectId } = await params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file'." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const doc = await uploadDocument(
      projectId,
      actor.id,
      buf,
      file.name || "unnamed",
      file.type || "application/octet-stream",
    );
    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      byteSize: doc.byteSize,
    });
  } catch (e) {
    if (e instanceof ProjectError) {
      const status =
        e.code === "PAYLOAD_TOO_LARGE" ? 413 :
        e.code === "UNSUPPORTED_TYPE" ? 415 :
        e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { OperatorError, savePhoto } from "@/lib/operators";

// Multipart upload — the photo field contains a single image (jpg/png/webp,
// ≤ 5 MB). On success, returns the new public photo URL.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser("ADMIN");
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'photo' file." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const photoPath = await savePhoto(id, buf, file.type);
    return NextResponse.json({ photoPath });
  } catch (e) {
    if (e instanceof OperatorError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

// Next 16 + Turbopack: 5 MB photo cap matches savePhoto()'s own check.
export const runtime = "nodejs";

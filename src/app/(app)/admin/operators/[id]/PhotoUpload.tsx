"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhotoAction } from "../actions";

export function PhotoUpload({
  operatorId,
  initialSrc,
  name,
}: {
  operatorId: string;
  initialSrc: string | null;
  name: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", f);
      const res = await fetch(`/api/operators/${operatorId}/photo`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }
      // Cache-bust so the new image loads immediately.
      setSrc(`${json.photoPath}?t=${Date.now()}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Remove this photo?")) return;
    startRemove(async () => {
      const res = await deletePhotoAction(operatorId);
      if (res.error) setError(res.error);
      else setSrc(null);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar src={src} name={name} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
      <div className="flex flex-wrap justify-center gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || removing}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : src ? "Replace photo" : "Add photo"}
        </button>
        {src ? (
          <button
            type="button"
            onClick={remove}
            disabled={uploading || removing}
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[150px] text-center text-xs text-red-700">{error}</p>
      ) : (
        <p className="max-w-[150px] text-center text-xs text-zinc-500">
          JPEG / PNG / WebP, ≤ 5 MB.
        </p>
      )}
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={`${name} photo`}
        className="h-28 w-28 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-200 text-3xl font-semibold text-zinc-700">
      {initial}
    </div>
  );
}

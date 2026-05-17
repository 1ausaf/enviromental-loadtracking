"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTicketPhotoAction } from "../actions";

type Photo = {
  id: string;
  filename: string;
  originalName: string;
  byteSize: number;
};

export function TicketPhotos({
  ticketId,
  initial,
}: {
  ticketId: string;
  initial: Photo[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("photo", f);
        const res = await fetch(`/api/tickets/${ticketId}/photos`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Upload failed.");
          break;
        }
        setPhotos((cur) => [
          ...cur,
          {
            id: json.id,
            filename: json.filename,
            originalName: json.originalName,
            byteSize: json.byteSize,
          },
        ]);
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    startRemove(async () => {
      const res = await deleteTicketPhotoAction(ticketId, id);
      if (res.error) setError(res.error);
      else {
        setPhotos((cur) => cur.filter((p) => p.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={onPick}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || removing}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "+ Add photo(s)"}
        </button>
        <span className="text-xs text-zinc-500">
          JPEG / PNG / WebP, ≤ 5 MB each.
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="text-sm text-zinc-500">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/uploads/tickets/${ticketId}/${p.filename}`}
                alt={p.originalName}
                className="aspect-square w-full rounded-md object-cover ring-1 ring-zinc-200"
              />
              <div className="mt-1 truncate text-xs text-zinc-600" title={p.originalName}>
                {p.originalName}
              </div>
              <button
                type="button"
                onClick={() => remove(p.id, p.originalName)}
                disabled={removing}
                className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-red-700 opacity-0 ring-1 ring-red-200 transition-opacity hover:bg-white group-hover:opacity-100 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

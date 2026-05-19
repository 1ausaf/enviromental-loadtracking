"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocumentAction } from "../actions";

type Doc = {
  id: string;
  filename: string;
  originalName: string;
  byteSize: number;
  mimeType: string;
  uploadedAt: string;
};

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({
  projectId,
  documents,
}: {
  projectId: string;
  documents: Doc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
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
      fd.append("file", f);
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(docId: string, name: string) {
    if (!confirm(`Remove "${name}" from the vault? The file will be deleted.`)) return;
    startRemove(async () => {
      const res = await deleteDocumentAction(projectId, docId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onPick}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.png,.jpg,.jpeg,.webp,.gif"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || removing}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "+ Upload file"}
        </button>
        <span className="text-xs text-zinc-500">Max 25 MB per file.</span>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No files in the vault yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <a
                  href={`/uploads/projects/${projectId}/${d.filename}`}
                  download={d.originalName}
                  target="_blank"
                  rel="noopener"
                  className="truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                >
                  {d.originalName}
                </a>
                <div className="text-xs text-zinc-500">
                  {humanBytes(d.byteSize)} · {dateFmt.format(new Date(d.uploadedAt))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(d.id, d.originalName)}
                disabled={removing}
                className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
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

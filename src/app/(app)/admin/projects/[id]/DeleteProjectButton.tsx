"use client";

import { useTransition } from "react";
import { deleteProjectAction } from "../actions";

export function DeleteProjectButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  async function onClick() {
    if (
      !confirm(
        "Delete this project? All assignments and vault files will be removed. " +
          "Set status to Completed instead if you want to keep the record.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteProjectAction(id);
      if (res?.error) alert(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-10 items-center rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete project"}
    </button>
  );
}

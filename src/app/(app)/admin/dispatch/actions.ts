"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  cancelDispatch,
  createDispatch,
  deleteDispatch,
  DispatchError,
  updateDispatch,
} from "@/lib/dispatches";

function parseDate(raw: FormDataEntryValue | null): Date {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new DispatchError("BAD_REQUEST", "Scheduled date/time is required.");
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw new DispatchError("BAD_REQUEST", "Invalid date/time.");
  }
  return d;
}

export type CreateDispatchState =
  | { status: "idle" }
  | { status: "error"; error: string };

export async function createDispatchAction(
  _prev: CreateDispatchState,
  formData: FormData,
): Promise<CreateDispatchState> {
  const actor = await requireUser("ADMIN");
  let created;
  try {
    created = await createDispatch(actor.id, {
      projectId: String(formData.get("projectId") ?? ""),
      operatorId: String(formData.get("operatorId") ?? ""),
      truckId: String(formData.get("truckId") ?? ""),
      scheduledFor: parseDate(formData.get("scheduledFor")),
      pickupNote: String(formData.get("pickupNote") ?? "") || null,
      dumpNote: String(formData.get("dumpNote") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    });
  } catch (e) {
    if (e instanceof DispatchError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to create dispatch." };
  }
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin");
  redirect(`/admin/dispatch/${created.id}`);
}

export type EditDispatchState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "saved" };

export async function updateDispatchAction(
  id: string,
  _prev: EditDispatchState,
  formData: FormData,
): Promise<EditDispatchState> {
  await requireUser("ADMIN");
  try {
    await updateDispatch(id, {
      projectId: String(formData.get("projectId") ?? ""),
      operatorId: String(formData.get("operatorId") ?? ""),
      truckId: String(formData.get("truckId") ?? ""),
      scheduledFor: parseDate(formData.get("scheduledFor")),
      pickupNote: String(formData.get("pickupNote") ?? "") || null,
      dumpNote: String(formData.get("dumpNote") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    });
  } catch (e) {
    if (e instanceof DispatchError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to update dispatch." };
  }
  revalidatePath("/admin/dispatch");
  revalidatePath(`/admin/dispatch/${id}`);
  return { status: "saved" };
}

export async function cancelDispatchAction(id: string): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await cancelDispatch(id);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Cancel failed." };
  }
  revalidatePath("/admin/dispatch");
  revalidatePath(`/admin/dispatch/${id}`);
  return {};
}

export async function deleteDispatchAction(id: string): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await deleteDispatch(id);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Delete failed." };
  }
  revalidatePath("/admin/dispatch");
  redirect("/admin/dispatch");
}

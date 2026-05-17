"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  approveException,
  declineException,
  ExceptionError,
} from "@/lib/exceptions";

export async function approveExceptionAction(
  id: string,
  note: string | null,
): Promise<{ error?: string }> {
  const actor = await requireUser("OWNER");
  try {
    await approveException(actor.id, id, note);
  } catch (e) {
    if (e instanceof ExceptionError) return { error: e.message };
    return { error: "Approve failed." };
  }
  revalidatePath("/owner");
  revalidatePath(`/owner/exceptions/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  return {};
}

export async function declineExceptionAction(
  id: string,
  note: string,
): Promise<{ error?: string }> {
  const actor = await requireUser("OWNER");
  try {
    await declineException(actor.id, id, note);
  } catch (e) {
    if (e instanceof ExceptionError) return { error: e.message };
    return { error: "Decline failed." };
  }
  revalidatePath("/owner");
  revalidatePath(`/owner/exceptions/${id}`);
  revalidatePath("/admin");
  return {};
}

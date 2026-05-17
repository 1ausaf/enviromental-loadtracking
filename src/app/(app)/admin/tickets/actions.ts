"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { approveTicket, flagTicket, TicketError } from "@/lib/tickets";
import { ExceptionError, requestOverride } from "@/lib/exceptions";

export async function approveTicketAction(ticketId: string): Promise<{ error?: string }> {
  const actor = await requireUser("ADMIN");
  try {
    await approveTicket(actor.id, ticketId);
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    return { error: "Approve failed." };
  }
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
  return {};
}

export async function flagTicketAction(
  ticketId: string,
  reason: string,
): Promise<{ error?: string }> {
  const actor = await requireUser("ADMIN");
  try {
    await flagTicket(actor.id, ticketId, reason);
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    return { error: "Flag failed." };
  }
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/owner");
  return {};
}

// Phase 9: admin explicitly requests Owner sign-off on something that's
// out-of-band of the normal approve/flag flow (e.g. "operator submitted
// with wrong truck, need approval to leave it as-is").
export async function requestOverrideAction(
  ticketId: string,
  summary: string,
  details: string,
): Promise<{ error?: string }> {
  const actor = await requireUser("ADMIN");
  try {
    await requestOverride(actor.id, { ticketId, summary, details });
  } catch (e) {
    if (e instanceof ExceptionError) return { error: e.message };
    return { error: "Couldn't raise the override request." };
  }
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/owner");
  return {};
}

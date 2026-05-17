"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { approveTicket, flagTicket, TicketError } from "@/lib/tickets";

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
  return {};
}

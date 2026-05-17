"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TruckType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  createDraft,
  deleteDraft,
  replaceLoadEntries,
  signAndSubmit,
  TicketError,
  updateDraft,
  type DraftPatch,
  type LoadEntryInput,
} from "@/lib/tickets";

const TRUCK_TYPES: TruckType[] = ["TRI_AXLE", "END_DUMP", "LIVE_BOTTOM", "FLOAT"];

function parseType(raw: FormDataEntryValue | null): TruckType | undefined {
  return typeof raw === "string" && (TRUCK_TYPES as string[]).includes(raw)
    ? (raw as TruckType)
    : undefined;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function operatorId(): Promise<string> {
  const actor = await requireUser("OPERATOR");
  const op = await prisma.operator.findUnique({ where: { userId: actor.id } });
  if (!op) throw new TicketError("FORBIDDEN", "Only operators can manage tickets.");
  return op.id;
}

export type CreateTicketState =
  | { status: "idle" }
  | { status: "error"; error: string };

// Spawns a new draft, then redirects to its detail page. Used by both the
// "New ticket" button on /operator/tickets and the auto-prefill landing
// after Phase 8's Complete Load action.
export async function createTicketAction(
  _prev: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  let created;
  try {
    const opId = await operatorId();
    const dispatchId = String(formData.get("dispatchId") ?? "") || null;
    created = await createDraft(opId, {
      dispatchId,
      equipmentType: parseType(formData.get("equipmentType")) ?? "TRI_AXLE",
      date: parseDate(formData.get("date")) ?? undefined,
    });
  } catch (e) {
    if (e instanceof TicketError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to create draft." };
  }
  revalidatePath("/operator/tickets");
  redirect(`/operator/tickets/${created.id}`);
}

export type EditTicketState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "saved" };

export async function saveDraftAction(
  ticketId: string,
  _prev: EditTicketState,
  formData: FormData,
): Promise<EditTicketState> {
  try {
    const opId = await operatorId();

    const patch: DraftPatch = {
      date: parseDate(formData.get("date")) ?? undefined,
      brokerName: String(formData.get("brokerName") ?? "") || null,
      truckNumber: String(formData.get("truckNumber") ?? "") || null,
      licensePlate: String(formData.get("licensePlate") ?? "") || null,
      companyHaulingFor: String(formData.get("companyHaulingFor") ?? "") || null,
      jobContractNumber: String(formData.get("jobContractNumber") ?? "") || null,
      pickupLocation: String(formData.get("pickupLocation") ?? "") || null,
      deliveryLocation: String(formData.get("deliveryLocation") ?? "") || null,
      equipmentType: parseType(formData.get("equipmentType")),
      used407ETR: formData.get("used407ETR") === "on",
      startTime: parseDate(formData.get("startTime")),
      endTime: parseDate(formData.get("endTime")),
      comments: String(formData.get("comments") ?? "") || null,
    };
    await updateDraft(opId, ticketId, patch);

    // Load entries: encoded as JSON in a hidden field so the client can
    // add/remove rows without re-rendering through the server.
    const rawEntries = formData.get("loadEntriesJson");
    if (typeof rawEntries === "string" && rawEntries.length > 0) {
      const parsed = JSON.parse(rawEntries) as Array<{ loadNumber: number; loadTime: string | null; notes: string | null }>;
      const entries: LoadEntryInput[] = parsed.map((e) => ({
        loadNumber: Number(e.loadNumber),
        loadTime: e.loadTime ? new Date(e.loadTime) : null,
        notes: e.notes || null,
      }));
      await replaceLoadEntries(opId, ticketId, entries);
    } else {
      await replaceLoadEntries(opId, ticketId, []);
    }
  } catch (e) {
    if (e instanceof TicketError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to save draft." };
  }
  revalidatePath("/operator/tickets");
  revalidatePath(`/operator/tickets/${ticketId}`);
  return { status: "saved" };
}

export async function signAndSubmitAction(
  ticketId: string,
  signatureDataUrl: string,
): Promise<{ error?: string }> {
  try {
    const opId = await operatorId();
    await signAndSubmit(opId, ticketId, signatureDataUrl);
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    return { error: "Submit failed." };
  }
  revalidatePath("/operator/tickets");
  revalidatePath(`/operator/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return {};
}

export async function deleteDraftAction(ticketId: string): Promise<{ error?: string }> {
  try {
    const opId = await operatorId();
    await deleteDraft(opId, ticketId);
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    return { error: "Delete failed." };
  }
  revalidatePath("/operator/tickets");
  redirect("/operator/tickets");
}

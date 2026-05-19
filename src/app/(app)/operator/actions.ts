"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  acceptDispatch,
  DispatchError,
  flagDispatch,
  startDispatch,
} from "@/lib/dispatches";
import {
  confirmDropoff,
  confirmPickup,
  DispatchLoadError,
} from "@/lib/dispatch-loads";

async function getOperatorIdOrThrow(userId: string): Promise<string> {
  const op = await prisma.operator.findUnique({ where: { userId } });
  if (!op) {
    throw new DispatchError(
      "FORBIDDEN",
      "Only operators can take dispatch actions.",
    );
  }
  return op.id;
}

type Result = { error?: string };

export async function acceptDispatchAction(dispatchId: string): Promise<Result> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    await acceptDispatch(operatorId, dispatchId);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Action failed." };
  }
  revalidatePath("/operator");
  revalidatePath("/admin/dispatch");
  return {};
}

export async function flagDispatchAction(
  dispatchId: string,
  reason: string,
): Promise<Result> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    await flagDispatch(operatorId, dispatchId, reason);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Action failed." };
  }
  revalidatePath("/operator");
  revalidatePath("/admin/dispatch");
  return {};
}

export async function startDispatchAction(dispatchId: string): Promise<Result> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    await startDispatch(operatorId, dispatchId);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Action failed." };
  }
  revalidatePath("/operator");
  revalidatePath("/admin/dispatch");
  return {};
}

// Geofence-driven confirmation. The operator's browser passes the current
// lat/lng with each tap; the server re-validates that they're inside the
// 50m fence around the project's pickup / drop coords. (Browsers can't be
// trusted to compute that themselves — a tampered client could bypass it.)
export async function confirmPickupAction(
  dispatchId: string,
  pos: { latitude: number; longitude: number; accuracy: number | null },
): Promise<Result> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    await confirmPickup(operatorId, dispatchId, pos);
  } catch (e) {
    if (e instanceof DispatchLoadError) return { error: e.message };
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Couldn't confirm pickup." };
  }
  revalidatePath("/operator");
  revalidatePath("/admin/dispatch");
  return {};
}

export async function confirmDropoffAction(
  dispatchId: string,
  pos: { latitude: number; longitude: number; accuracy: number | null },
): Promise<{ error?: string; complete?: boolean; loadsCompleted?: number; loadsAssigned?: number }> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    const result = await confirmDropoff(operatorId, dispatchId, pos);
    revalidatePath("/operator");
    revalidatePath("/admin/dispatch");
    return result;
  } catch (e) {
    if (e instanceof DispatchLoadError) return { error: e.message };
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Couldn't confirm drop-off." };
  }
}

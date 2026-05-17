"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  acceptDispatch,
  advanceDispatch,
  DispatchError,
  flagDispatch,
  startDispatch,
} from "@/lib/dispatches";

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

export async function advanceDispatchAction(dispatchId: string): Promise<Result> {
  const actor = await requireUser("OPERATOR");
  try {
    const operatorId = await getOperatorIdOrThrow(actor.id);
    await advanceDispatch(operatorId, dispatchId);
  } catch (e) {
    if (e instanceof DispatchError) return { error: e.message };
    return { error: "Action failed." };
  }
  revalidatePath("/operator");
  revalidatePath("/admin/dispatch");
  return {};
}

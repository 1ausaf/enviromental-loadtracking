"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TruckStatus, TruckType } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import {
  assignTruck,
  createTruck,
  deleteTruck,
  TruckError,
  updateTruck,
} from "@/lib/trucks";

const TRUCK_TYPES: TruckType[] = ["TRI_AXLE", "END_DUMP", "LIVE_BOTTOM", "FLOAT"];
const TRUCK_STATUSES: TruckStatus[] = ["ACTIVE", "MAINTENANCE", "INACTIVE"];

function parseType(raw: FormDataEntryValue | null): TruckType {
  if (typeof raw === "string" && (TRUCK_TYPES as string[]).includes(raw)) {
    return raw as TruckType;
  }
  throw new TruckError("BAD_REQUEST", "Pick a truck type.");
}

function parseStatus(raw: FormDataEntryValue | null): TruckStatus {
  if (typeof raw === "string" && (TRUCK_STATUSES as string[]).includes(raw)) {
    return raw as TruckStatus;
  }
  throw new TruckError("BAD_REQUEST", "Pick a status.");
}

function parseCapacity(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new TruckError("BAD_REQUEST", "Capacity must be a positive number (tonnes).");
  }
  return n;
}

export type CreateTruckState = { status: "idle" } | { status: "error"; error: string };

export async function createTruckAction(
  _prev: CreateTruckState,
  formData: FormData,
): Promise<CreateTruckState> {
  await requireUser("ADMIN");
  let created;
  try {
    created = await createTruck({
      licensePlate: String(formData.get("licensePlate") ?? ""),
      type: parseType(formData.get("type")),
      capacityTonnes: parseCapacity(formData.get("capacityTonnes")),
      colour: String(formData.get("colour") ?? ""),
      status: parseStatus(formData.get("status")),
    });
  } catch (e) {
    if (e instanceof TruckError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to create truck." };
  }
  revalidatePath("/admin/trucks");
  redirect(`/admin/trucks/${created.id}`);
}

export type EditTruckState = { status: "idle" } | { status: "error"; error: string } | { status: "saved" };

export async function updateTruckAction(
  id: string,
  _prev: EditTruckState,
  formData: FormData,
): Promise<EditTruckState> {
  await requireUser("ADMIN");
  try {
    await updateTruck(id, {
      licensePlate: String(formData.get("licensePlate") ?? ""),
      type: parseType(formData.get("type")),
      capacityTonnes: parseCapacity(formData.get("capacityTonnes")),
      colour: String(formData.get("colour") ?? ""),
      status: parseStatus(formData.get("status")),
    });
  } catch (e) {
    if (e instanceof TruckError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to update truck." };
  }
  revalidatePath("/admin/trucks");
  revalidatePath(`/admin/trucks/${id}`);
  return { status: "saved" };
}

export async function assignTruckAction(
  truckId: string,
  operatorId: string | null,
): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await assignTruck(truckId, operatorId);
  } catch (e) {
    if (e instanceof TruckError) return { error: e.message };
    return { error: "Assignment failed." };
  }
  revalidatePath("/admin/trucks");
  revalidatePath(`/admin/trucks/${truckId}`);
  revalidatePath("/admin/operators");
  return {};
}

export async function deleteTruckAction(truckId: string): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await deleteTruck(truckId);
  } catch (e) {
    if (e instanceof TruckError) return { error: e.message };
    return { error: "Delete failed." };
  }
  revalidatePath("/admin/trucks");
  redirect("/admin/trucks");
}

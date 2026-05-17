"use server";

import { revalidatePath } from "next/cache";
import type { LicenceClass } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import {
  deletePhoto,
  OperatorError,
  updateOperator,
} from "@/lib/operators";

const LICENCE_CLASSES: LicenceClass[] = ["AZ", "DZ", "BZ", "CZ", "G"];

export type EditOperatorState = { status: "idle" } | { status: "error"; error: string } | { status: "saved" };

export async function updateOperatorAction(
  id: string,
  _prev: EditOperatorState,
  formData: FormData,
): Promise<EditOperatorState> {
  await requireUser("ADMIN");
  const phoneRaw = formData.get("phone");
  const phone = typeof phoneRaw === "string" ? phoneRaw : "";
  const licenceRaw = formData.get("licenceClass");
  const licenceClass: LicenceClass | null =
    typeof licenceRaw === "string" && (LICENCE_CLASSES as string[]).includes(licenceRaw)
      ? (licenceRaw as LicenceClass)
      : null;

  try {
    await updateOperator(id, { phone, licenceClass });
  } catch (e) {
    if (e instanceof OperatorError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to save changes." };
  }
  revalidatePath("/admin/operators");
  revalidatePath(`/admin/operators/${id}`);
  return { status: "saved" };
}

export async function deletePhotoAction(operatorId: string): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await deletePhoto(operatorId);
  } catch {
    return { error: "Failed to remove photo." };
  }
  revalidatePath("/admin/operators");
  revalidatePath(`/admin/operators/${operatorId}`);
  return {};
}

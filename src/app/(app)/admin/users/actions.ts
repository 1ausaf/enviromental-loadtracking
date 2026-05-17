"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { isRole } from "@/lib/roles";
import {
  createUser,
  deleteUser,
  ManageError,
  setUserActive,
  type CreateUserResult,
} from "@/lib/users";

export type CreateState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "success"; result: CreateUserResult };

export async function createUserAction(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const actor = await requireUser("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  if (!isRole(roleRaw)) return { status: "error", error: "Pick a role." };

  try {
    const result = await createUser(
      { role: actor.role },
      { name, email, role: roleRaw },
    );
    revalidatePath("/admin/users");
    return { status: "success", result };
  } catch (e) {
    if (e instanceof ManageError) return { status: "error", error: e.message };
    return { status: "error", error: "Something went wrong creating the user." };
  }
}

export async function setActiveAction(targetId: string, active: boolean): Promise<void> {
  const actor = await requireUser("ADMIN");
  await setUserActive({ id: actor.id, role: actor.role }, targetId, active);
  revalidatePath("/admin/users");
}

export async function deleteUserAction(targetId: string): Promise<{ error?: string }> {
  const actor = await requireUser("ADMIN");
  try {
    await deleteUser({ id: actor.id, role: actor.role }, targetId);
    revalidatePath("/admin/users");
    return {};
  } catch (e) {
    if (e instanceof ManageError) return { error: e.message };
    return { error: "Delete failed." };
  }
}

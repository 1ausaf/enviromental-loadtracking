"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import {
  addOperatorToProject,
  addTruckToProject,
  createProject,
  deleteDocument,
  deleteProject,
  ProjectError,
  removeOperatorFromProject,
  removeTruckFromProject,
  updateProject,
} from "@/lib/projects";

const STATUSES: ProjectStatus[] = ["ACTIVE", "COMPLETED"];

function parseDate(raw: FormDataEntryValue | null, allowEmpty = false): Date | null {
  if (!raw || typeof raw !== "string") {
    if (allowEmpty) return null;
    throw new ProjectError("BAD_REQUEST", "Date is required.");
  }
  const s = raw.trim();
  if (s === "") {
    if (allowEmpty) return null;
    throw new ProjectError("BAD_REQUEST", "Date is required.");
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new ProjectError("BAD_REQUEST", "Invalid date.");
  return d;
}

function parseNumber(raw: FormDataEntryValue | null, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new ProjectError("BAD_REQUEST", `${label} must be a number.`);
  return n;
}

function parseStatus(raw: FormDataEntryValue | null): ProjectStatus {
  if (typeof raw === "string" && (STATUSES as string[]).includes(raw)) {
    return raw as ProjectStatus;
  }
  return "ACTIVE";
}

export type CreateProjectState = { status: "idle" } | { status: "error"; error: string };

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  await requireUser("ADMIN");
  let created;
  try {
    const startDate = parseDate(formData.get("startDate"));
    if (!startDate) throw new ProjectError("BAD_REQUEST", "Start date is required.");
    created = await createProject({
      name: String(formData.get("name") ?? ""),
      client: String(formData.get("client") ?? ""),
      address: String(formData.get("address") ?? ""),
      startDate,
      endDate: parseDate(formData.get("endDate"), true),
      materialBudget: parseNumber(formData.get("materialBudget"), "Material budget"),
      loadTarget: Math.trunc(parseNumber(formData.get("loadTarget"), "Load target")),
      scheduleNotes: String(formData.get("scheduleNotes") ?? "") || null,
      status: parseStatus(formData.get("status")),
    });
  } catch (e) {
    if (e instanceof ProjectError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to create project." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${created.id}`);
}

export type EditProjectState = { status: "idle" } | { status: "error"; error: string } | { status: "saved" };

export async function updateProjectAction(
  id: string,
  _prev: EditProjectState,
  formData: FormData,
): Promise<EditProjectState> {
  await requireUser("ADMIN");
  try {
    const startDate = parseDate(formData.get("startDate"));
    if (!startDate) throw new ProjectError("BAD_REQUEST", "Start date is required.");
    await updateProject(id, {
      name: String(formData.get("name") ?? ""),
      client: String(formData.get("client") ?? ""),
      address: String(formData.get("address") ?? ""),
      startDate,
      endDate: parseDate(formData.get("endDate"), true),
      materialBudget: parseNumber(formData.get("materialBudget"), "Material budget"),
      loadTarget: Math.trunc(parseNumber(formData.get("loadTarget"), "Load target")),
      scheduleNotes: String(formData.get("scheduleNotes") ?? "") || null,
      status: parseStatus(formData.get("status")),
    });
  } catch (e) {
    if (e instanceof ProjectError) return { status: "error", error: e.message };
    return { status: "error", error: "Failed to update project." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  return { status: "saved" };
}

export async function deleteProjectAction(id: string): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await deleteProject(id);
  } catch (e) {
    if (e instanceof ProjectError) return { error: e.message };
    return { error: "Delete failed." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function setOperatorAssignmentAction(
  projectId: string,
  operatorId: string,
  attach: boolean,
): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    if (attach) await addOperatorToProject(projectId, operatorId);
    else await removeOperatorFromProject(projectId, operatorId);
  } catch {
    return { error: "Failed to update operator assignment." };
  }
  revalidatePath(`/admin/projects/${projectId}`);
  return {};
}

export async function setTruckAssignmentAction(
  projectId: string,
  truckId: string,
  attach: boolean,
): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    if (attach) await addTruckToProject(projectId, truckId);
    else await removeTruckFromProject(projectId, truckId);
  } catch {
    return { error: "Failed to update truck assignment." };
  }
  revalidatePath(`/admin/projects/${projectId}`);
  return {};
}

export async function deleteDocumentAction(
  projectId: string,
  documentId: string,
): Promise<{ error?: string }> {
  await requireUser("ADMIN");
  try {
    await deleteDocument(projectId, documentId);
  } catch (e) {
    if (e instanceof ProjectError) return { error: e.message };
    return { error: "Delete failed." };
  }
  revalidatePath(`/admin/projects/${projectId}`);
  return {};
}

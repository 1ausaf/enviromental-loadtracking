import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma, ProjectStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export class ProjectError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_TYPE",
    message: string,
  ) {
    super(message);
  }
}

export type CreateProjectInput = {
  name: string;
  client: string;
  address: string;
  startDate: Date;
  endDate: Date | null;
  materialBudget: number;
  loadTarget: number;
  scheduleNotes: string | null;
  status?: ProjectStatus;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

function validate(input: CreateProjectInput | UpdateProjectInput): void {
  if (input.name !== undefined && input.name.trim().length < 2) {
    throw new ProjectError("BAD_REQUEST", "Project name is required.");
  }
  if (input.client !== undefined && input.client.trim().length < 2) {
    throw new ProjectError("BAD_REQUEST", "Client name is required.");
  }
  if (input.address !== undefined && input.address.trim().length < 2) {
    throw new ProjectError("BAD_REQUEST", "Address is required.");
  }
  if (input.materialBudget !== undefined && (!Number.isFinite(input.materialBudget) || input.materialBudget < 0)) {
    throw new ProjectError("BAD_REQUEST", "Material budget must be ≥ 0.");
  }
  if (input.loadTarget !== undefined && (!Number.isInteger(input.loadTarget) || input.loadTarget < 0)) {
    throw new ProjectError("BAD_REQUEST", "Load target must be a non-negative whole number.");
  }
  if (
    input.startDate !== undefined &&
    input.endDate !== undefined &&
    input.endDate !== null &&
    input.endDate < input.startDate
  ) {
    throw new ProjectError("BAD_REQUEST", "End date must be on or after the start date.");
  }
}

export async function createProject(input: CreateProjectInput) {
  validate(input);
  return prisma.project.create({
    data: {
      name: input.name.trim(),
      client: input.client.trim(),
      address: input.address.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      materialBudget: input.materialBudget,
      loadTarget: input.loadTarget,
      scheduleNotes: input.scheduleNotes?.trim() || null,
      status: input.status ?? "ACTIVE",
    },
  });
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  validate(input);
  const data: Prisma.ProjectUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.client !== undefined) data.client = input.client.trim();
  if (input.address !== undefined) data.address = input.address.trim();
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;
  if (input.materialBudget !== undefined) data.materialBudget = input.materialBudget;
  if (input.loadTarget !== undefined) data.loadTarget = input.loadTarget;
  if (input.scheduleNotes !== undefined) data.scheduleNotes = input.scheduleNotes?.trim() || null;
  if (input.status !== undefined) data.status = input.status;
  try {
    return await prisma.project.update({ where: { id }, data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      throw new ProjectError("NOT_FOUND", "Project not found.");
    }
    throw e;
  }
}

export async function deleteProject(id: string): Promise<void> {
  // Wipe the on-disk document directory before deleting the row — cascade
  // takes care of all child rows.
  await fs.rm(projectDocDir(id), { recursive: true, force: true });
  try {
    await prisma.project.delete({ where: { id } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      throw new ProjectError("NOT_FOUND", "Project not found.");
    }
    throw e;
  }
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      operators: {
        include: {
          operator: { include: { user: { select: { name: true, employeeId: true, isActive: true } } } },
        },
        orderBy: { assignedAt: "asc" },
      },
      trucks: {
        include: { truck: { select: { id: true, licensePlate: true, type: true, status: true } } },
        orderBy: { assignedAt: "asc" },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!project) throw new ProjectError("NOT_FOUND", "Project not found.");
  return project;
}

export type ListProjectsFilters = {
  query?: string;
  status?: ProjectStatus | "ALL";
};

export async function listProjects(filters: ListProjectsFilters = {}) {
  const where: Prisma.ProjectWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { client: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 200,
  });
}

export async function listActiveProjectsWithCounts() {
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { operators: true, trucks: true } },
    },
  });
  return Promise.all(
    projects.map(async (p) => ({
      ...p,
      progress: await getProjectProgress(p.id, p.loadTarget),
      issueCount: await getFlaggedIssueCount(p.id),
    })),
  );
}

// --- Assignments ----------------------------------------------------------

export async function addOperatorToProject(projectId: string, operatorId: string): Promise<void> {
  try {
    await prisma.operatorOnProject.create({ data: { projectId, operatorId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return; // already assigned — idempotent
    throw e;
  }
}

export async function removeOperatorFromProject(projectId: string, operatorId: string): Promise<void> {
  await prisma.operatorOnProject.deleteMany({ where: { projectId, operatorId } });
}

export async function addTruckToProject(projectId: string, truckId: string): Promise<void> {
  try {
    await prisma.truckOnProject.create({ data: { projectId, truckId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return;
    throw e;
  }
}

export async function removeTruckFromProject(projectId: string, truckId: string): Promise<void> {
  await prisma.truckOnProject.deleteMany({ where: { projectId, truckId } });
}

// --- Documents ------------------------------------------------------------

const DOC_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_DOC_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
]);

function projectDocDir(projectId: string): string {
  return path.join(process.cwd(), "public", "uploads", "projects", projectId);
}

function safeExtFromName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length > 1 && ext.length <= 8 ? ext : ".bin";
}

export async function uploadDocument(
  projectId: string,
  uploadedById: string,
  buf: Buffer,
  originalName: string,
  mimeType: string,
) {
  if (!ALLOWED_DOC_MIME.has(mimeType)) {
    throw new ProjectError(
      "UNSUPPORTED_TYPE",
      "Document type not allowed. Allowed: PDF, Office docs, images, CSV, TXT, ZIP.",
    );
  }
  if (buf.byteLength > DOC_MAX_BYTES) {
    throw new ProjectError("PAYLOAD_TOO_LARGE", "File must be 25 MB or smaller.");
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ProjectError("NOT_FOUND", "Project not found.");

  await fs.mkdir(projectDocDir(projectId), { recursive: true });

  const id = `c${crypto.randomBytes(12).toString("hex")}`;
  const filename = `${id}${safeExtFromName(originalName)}`;
  await fs.writeFile(path.join(projectDocDir(projectId), filename), buf);

  return prisma.projectDocument.create({
    data: {
      id,
      projectId,
      filename,
      originalName,
      mimeType,
      byteSize: buf.byteLength,
      uploadedById,
    },
  });
}

export async function deleteDocument(projectId: string, documentId: string): Promise<void> {
  const doc = await prisma.projectDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.projectId !== projectId) {
    throw new ProjectError("NOT_FOUND", "Document not found.");
  }
  await fs.rm(path.join(projectDocDir(projectId), doc.filename), { force: true });
  await prisma.projectDocument.delete({ where: { id: documentId } });
}

export function documentPublicUrl(projectId: string, filename: string): string {
  return `/uploads/projects/${projectId}/${filename}`;
}

// --- Stubs wired to real data in Phase 7/8 --------------------------------

export type ProjectProgress = {
  completedLoads: number;
  loadTarget: number;
  percent: number;
};

export async function getProjectProgress(
  projectId: string,
  loadTarget?: number,
): Promise<ProjectProgress> {
  // Phase 7: count Ticket rows where projectId = projectId and status='APPROVED'.
  const target =
    loadTarget ??
    (await prisma.project.findUnique({ where: { id: projectId }, select: { loadTarget: true } }))
      ?.loadTarget ??
    0;
  const completed = 0;
  const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  return { completedLoads: completed, loadTarget: target, percent };
}

export async function getFlaggedIssueCount(_projectId: string): Promise<number> {
  // Phase 7: Ticket rows with status='FLAGGED'.
  // Phase 9: routed exceptions awaiting Owner approval.
  return 0;
}

import fs from "node:fs/promises";
import path from "node:path";
import type { LicenceClass, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type UpdateOperatorInput = {
  phone?: string | null;
  licenceClass?: LicenceClass | null;
};

export class OperatorError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "NOT_FOUND" | "PHOTO_TOO_BIG" | "PHOTO_TYPE",
    message: string,
  ) {
    super(message);
  }
}

export async function listOperators(query?: string) {
  const where: Prisma.OperatorWhereInput = {};
  if (query) {
    const q = query.trim();
    where.user = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { employeeId: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  return prisma.operator.findMany({
    where,
    orderBy: { user: { name: "asc" } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          isActive: true,
        },
      },
      currentTruck: {
        select: { id: true, licensePlate: true, type: true, status: true, colour: true },
      },
    },
    take: 200,
  });
}

export async function getOperator(id: string) {
  const op = await prisma.operator.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          isActive: true,
          role: true,
        },
      },
      currentTruck: {
        select: { id: true, licensePlate: true, type: true, status: true, colour: true },
      },
    },
  });
  if (!op) throw new OperatorError("NOT_FOUND", "Operator not found.");
  return op;
}

export async function updateOperator(id: string, input: UpdateOperatorInput) {
  const data: Prisma.OperatorUpdateInput = {};
  if (input.phone !== undefined) {
    const phone = input.phone === null ? null : input.phone.trim() || null;
    data.phone = phone;
  }
  if (input.licenceClass !== undefined) data.licenceClass = input.licenceClass;

  try {
    return await prisma.operator.update({ where: { id }, data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      throw new OperatorError("NOT_FOUND", "Operator not found.");
    }
    throw e;
  }
}

// --- Photo storage ----------------------------------------------------------
// Local disk under public/uploads/operators/ — production should swap for
// object storage (S3, R2, Tencent COS, etc.). Keep the path layout stable so
// the swap is mechanical.

const PHOTO_DIR = path.join(process.cwd(), "public", "uploads", "operators");
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function savePhoto(
  operatorId: string,
  buf: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = ALLOWED_PHOTO_EXT[mimeType.toLowerCase()];
  if (!ext) {
    throw new OperatorError(
      "PHOTO_TYPE",
      "Photo must be a JPEG, PNG, or WebP image.",
    );
  }
  if (buf.byteLength > PHOTO_MAX_BYTES) {
    throw new OperatorError("PHOTO_TOO_BIG", "Photo must be 5 MB or smaller.");
  }

  await fs.mkdir(PHOTO_DIR, { recursive: true });

  // Clean up old photo of any extension before writing the new one.
  for (const oldExt of Object.values(ALLOWED_PHOTO_EXT)) {
    await fs.rm(path.join(PHOTO_DIR, `${operatorId}.${oldExt}`), { force: true });
  }

  const filename = `${operatorId}.${ext}`;
  await fs.writeFile(path.join(PHOTO_DIR, filename), buf);
  const photoPath = `/uploads/operators/${filename}`;

  await prisma.operator.update({
    where: { id: operatorId },
    data: { photoPath },
  });

  return photoPath;
}

export async function deletePhoto(operatorId: string): Promise<void> {
  for (const ext of Object.values(ALLOWED_PHOTO_EXT)) {
    await fs.rm(path.join(PHOTO_DIR, `${operatorId}.${ext}`), { force: true });
  }
  await prisma.operator.update({
    where: { id: operatorId },
    data: { photoPath: null },
  });
}

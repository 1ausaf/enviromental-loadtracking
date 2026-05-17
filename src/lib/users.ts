import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { nextEmployeeId } from "@/lib/employee-id";
import { hashPassword } from "@/lib/password";
import { hasAccess, type Role } from "@/lib/roles";

export type CreateUserInput = {
  name: string;
  email: string;
  role: Role;
};

export type CreateUserResult = {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    employeeId: string;
  };
  tempPassword: string;
};

// Privilege rule: an actor can only manage users at or below their own rank.
// OWNER can manage all; ADMIN can manage ADMIN + OPERATOR; OPERATOR can't.
function ensureCanManage(actor: Role, target: Role): void {
  if (!hasAccess("ADMIN", actor)) {
    throw new ManageError("FORBIDDEN", "Only Admin and Owner can manage users.");
  }
  if (!hasAccess(target, actor)) {
    throw new ManageError(
      "FORBIDDEN",
      "You can't manage a user whose role outranks yours.",
    );
  }
}

export class ManageError extends Error {
  constructor(
    public code: "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

// Memorable-ish but strong default password: 12 chars from URL-safe alphabet.
// Communicated to the new user out-of-band; they should reset via the
// forgot-password flow on first sign-in.
export function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createUser(
  actor: { role: Role },
  input: CreateUserInput,
): Promise<CreateUserResult> {
  ensureCanManage(actor.role, input.role);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email.includes("@")) throw new ManageError("BAD_REQUEST", "Email looks invalid.");
  if (name.length < 2) throw new ManageError("BAD_REQUEST", "Name is required.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ManageError("CONFLICT", "An account with that email already exists.");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const employeeId = await nextEmployeeId();

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: input.role,
      passwordHash,
      employeeId,
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true, employeeId: true },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: user.employeeId ?? employeeId,
    },
    tempPassword,
  };
}

export async function setUserActive(
  actor: { id: string; role: Role },
  targetId: string,
  active: boolean,
): Promise<void> {
  if (targetId === actor.id) {
    throw new ManageError("BAD_REQUEST", "You can't change your own active state.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) throw new ManageError("NOT_FOUND", "User not found.");
  ensureCanManage(actor.role, target.role);

  if (target.isActive === active) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { isActive: active },
    }),
    // Deactivation must also kick the user out NOW — otherwise their existing
    // session keeps working until the 7-day cookie expires.
    ...(active
      ? []
      : [
          prisma.session.updateMany({
            where: { userId: target.id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]),
  ]);
}

export async function deleteUser(
  actor: { id: string; role: Role },
  targetId: string,
): Promise<void> {
  if (targetId === actor.id) {
    throw new ManageError("BAD_REQUEST", "You can't delete your own account.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw new ManageError("NOT_FOUND", "User not found.");
  ensureCanManage(actor.role, target.role);

  // Don't allow nuking the last Owner — leaves the org locked out of
  // exception approvals (proposal §2.8).
  if (target.role === "OWNER") {
    const ownerCount = await prisma.user.count({
      where: { role: "OWNER", isActive: true },
    });
    if (ownerCount <= 1) {
      throw new ManageError(
        "BAD_REQUEST",
        "Can't delete the last Owner — promote another user to Owner first.",
      );
    }
  }

  // Cascading FKs (Session, SessionEvent, PasswordReset) handle the rest.
  await prisma.user.delete({ where: { id: target.id } });
}

export type ListFilters = {
  query?: string;
  role?: Role | "ALL";
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  take?: number;
};

export async function listUsers(filters: ListFilters) {
  const where: Prisma.UserWhereInput = {};
  if (filters.role && filters.role !== "ALL") where.role = filters.role;
  if (filters.status === "ACTIVE") where.isActive = true;
  if (filters.status === "INACTIVE") where.isActive = false;
  if (filters.query) {
    const q = filters.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { employeeId: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: filters.take ?? 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employeeId: true,
      isActive: true,
      createdAt: true,
    },
  });
}

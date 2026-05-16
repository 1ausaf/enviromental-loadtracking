export type Role = "OWNER" | "ADMIN" | "OPERATOR";

export const ROLES: readonly Role[] = ["OWNER", "ADMIN", "OPERATOR"] as const;

const RANK: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  OPERATOR: 1,
};

export function hasAccess(required: Role, actual: Role): boolean {
  return RANK[actual] >= RANK[required];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

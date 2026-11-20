import "server-only";
import { redirect, notFound } from "next/navigation";
import type { Prisma, Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type SessionUser = Session["user"];

export class Forbidden extends Error {
  constructor(msg = "You don't have access to that.") {
    super(msg);
  }
}

/** Current user or redirect to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user?.id) redirect("/signin");
  return s.user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Forbidden();
  return u;
}

export const isAdmin = (u: SessionUser) => u.role === "BROKER_ADMIN" || u.role === "EMPLOYER_ADMIN";

/**
 * Prisma `where` that limits EmployerGroup queries to what this user may see.
 * Every group/plan/employee/election query should go through this (or groupFilterFor).
 */
export function groupScope(u: SessionUser): Prisma.EmployerGroupWhereInput {
  switch (u.role) {
    case "BROKER_ADMIN":
      return u.agencyId ? { agencyId: u.agencyId } : { id: "__none__" };
    case "EMPLOYER_ADMIN":
      return u.groupId && u.agencyId ? { id: u.groupId, agencyId: u.agencyId } : { id: "__none__" };
    case "EMPLOYEE":
      return u.employeeId ? { employees: { some: { id: u.employeeId } } } : { id: "__none__" };
    default:
      return { id: "__none__" };
  }
}

/** Load a group the user may administer, or 404 (we don't reveal that it exists). */
export async function requireAdminGroup(groupId: string) {
  const u = await requireUser();
  if (!isAdmin(u)) notFound();
  const group = await prisma.employerGroup.findFirst({ where: { id: groupId, ...groupScope(u) } });
  if (!group) notFound();
  return { user: u, group };
}

/** The signed-in employee's own Employee row (with group). Employees can only ever touch this. */
export async function requireOwnEmployee() {
  const u = await requireUser();
  if (u.role !== "EMPLOYEE" || !u.employeeId) redirect("/");
  const employee = await prisma.employee.findUnique({
    where: { id: u.employeeId },
    include: { group: true },
  });
  if (!employee || employee.userId !== u.id) throw new Forbidden();
  return { user: u, employee };
}

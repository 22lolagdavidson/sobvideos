"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { Forbidden, requireAdminGroup, requireRole } from "@/lib/authz";
import { parseRoster } from "@/lib/roster";
import {
  EmployeeInput,
  GroupInput,
  PlanInput,
  fieldErrors,
  formObject,
  toDate,
  type FormState,
} from "@/lib/validation/forms";

/*
 * Group setup actions. Permissions:
 *  - BROKER_ADMIN (same agency): everything.
 *  - EMPLOYER_ADMIN (own group): roster only. Group terms and plans/rates are the broker's.
 * Every change is audit-logged with before/after snapshots.
 */

const setupPath = (groupId: string) => `/groups/${groupId}/setup`;

async function brokerGroup(groupId: string) {
  const ctx = await requireAdminGroup(groupId);
  if (ctx.user.role !== "BROKER_ADMIN") throw new Forbidden("Only your broker can change this.");
  return ctx;
}

function groupData(g: GroupInput) {
  return {
    name: g.name,
    planYear: g.planYear,
    effectiveDate: toDate(g.effectiveDate),
    windowStart: toDate(g.windowStart),
    windowEnd: toDate(g.windowEnd),
    payPeriods: g.payPeriods,
    eePct: g.eePct,
    depPct: g.depPct,
    participationTarget: g.participationTarget,
  };
}

// ------------------------------------------------------------------ groups

export async function createGroup(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireRole("BROKER_ADMIN");
  if (!user.agencyId) throw new Forbidden();
  const parsed = GroupInput.safeParse(formObject(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), message: "Please fix the highlighted fields.", values: formObject(fd) as Record<string, string> };
  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.employerGroup.create({ data: { agencyId: user.agencyId!, ...groupData(parsed.data) } });
    await audit({ actor: user, action: "group.create", entity: "EmployerGroup", entityId: g.id, groupId: g.id, after: g }, tx);
    return g;
  });
  redirect(setupPath(group.id));
}

export async function updateGroup(groupId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, group } = await brokerGroup(groupId);
  const parsed = GroupInput.safeParse(formObject(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), message: "Please fix the highlighted fields.", values: formObject(fd) as Record<string, string> };
  await prisma.$transaction(async (tx) => {
    const after = await tx.employerGroup.update({ where: { id: group.id }, data: groupData(parsed.data) });
    await audit({ actor: user, action: "group.update", entity: "EmployerGroup", entityId: group.id, groupId, before: group, after }, tx);
  });
  revalidatePath(setupPath(groupId));
  return { ok: true, message: "Group details saved." };
}

// ------------------------------------------------------------------ roster

const MAX_ROSTER_BYTES = 1024 * 1024;

export type ImportState = FormState & {
  added?: number;
  updated?: number;
  errors?: { line: number; text: string; error: string }[];
};

/** Paste or CSV upload. Adds new emails and updates names/hire dates of existing ones. Never deletes. */
export async function importRoster(groupId: string, _: ImportState, fd: FormData): Promise<ImportState> {
  const { user, group } = await requireAdminGroup(groupId);
  let text = String(fd.get("text") ?? "");
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ROSTER_BYTES) return { message: "That file is over 1 MB. Split it up or paste the rows instead." };
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && !/^text\//.test(file.type))
      return { message: "Upload a .csv file (save your spreadsheet as CSV first)." };
    text = await file.text();
  }
  if (!text.trim()) return { message: "Paste some rows or choose a CSV file." };

  const { rows, errors } = parseRoster(text);
  if (!rows.length) return { message: "No rows could be imported.", errors };

  const existing = await prisma.employee.findMany({ where: { groupId, email: { in: rows.map((r) => r.email) } } });
  const byEmail = new Map(existing.map((e) => [e.email, e]));
  let added = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const data = { name: r.name, hireDate: r.hireDate ? toDate(r.hireDate) : null };
      const cur = byEmail.get(r.email);
      if (cur) {
        const same = cur.name === data.name && (cur.hireDate?.getTime() ?? null) === (data.hireDate?.getTime() ?? null);
        if (same) continue;
        const after = await tx.employee.update({ where: { id: cur.id }, data });
        await audit({ actor: user, action: "employee.update", entity: "Employee", entityId: cur.id, groupId, before: cur, after }, tx);
        updated++;
      } else {
        const after = await tx.employee.create({ data: { groupId, email: r.email, eligible: true, ...data } });
        await audit({ actor: user, action: "employee.create", entity: "Employee", entityId: after.id, groupId, after }, tx);
        added++;
      }
    }
    await audit(
      { actor: user, action: "roster.import", entity: "EmployerGroup", entityId: group.id, groupId, after: { added, updated, skipped: errors.length } },
      tx,
    );
  });
  revalidatePath(setupPath(groupId));
  return {
    ok: true,
    added,
    updated,
    errors,
    message: `Imported: ${added} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}.`,
  };
}

export async function saveEmployee(groupId: string, employeeId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireAdminGroup(groupId);
  const parsed = EmployeeInput.safeParse(formObject(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), message: "Please fix the highlighted fields.", values: formObject(fd) as Record<string, string> };
  const v = parsed.data;
  const data = { name: v.name, email: v.email, hireDate: v.hireDate ? toDate(v.hireDate) : null, eligible: v.eligible };

  const clash = await prisma.employee.findFirst({
    where: { groupId, email: v.email, ...(employeeId ? { NOT: { id: employeeId } } : {}) },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { email: "Someone on this roster already uses that email" }, values: formObject(fd) as Record<string, string> };

  if (!employeeId) {
    await prisma.$transaction(async (tx) => {
      const after = await tx.employee.create({ data: { groupId, ...data } });
      await audit({ actor: user, action: "employee.create", entity: "Employee", entityId: after.id, groupId, after }, tx);
    });
    revalidatePath(setupPath(groupId));
    return { ok: true, message: `Added ${v.name}.` };
  }

  const cur = await prisma.employee.findFirst({ where: { id: employeeId, groupId } });
  if (!cur) throw new Forbidden();
  if (cur.userId && cur.email !== v.email)
    return {
      fieldErrors: { email: "This person has already signed in, so their email can't be changed here. Contact support." },
      values: formObject(fd) as Record<string, string>,
    };
  await prisma.$transaction(async (tx) => {
    const after = await tx.employee.update({ where: { id: cur.id }, data });
    await audit({ actor: user, action: "employee.update", entity: "Employee", entityId: cur.id, groupId, before: cur, after }, tx);
  });
  revalidatePath(setupPath(groupId));
  return { ok: true, message: "Saved." };
}

export async function removeEmployee(groupId: string, employeeId: string): Promise<FormState> {
  const { user } = await requireAdminGroup(groupId);
  const cur = await prisma.employee.findFirst({ where: { id: employeeId, groupId }, include: { _count: { select: { elections: true } } } });
  if (!cur) throw new Forbidden();
  if (cur._count.elections > 0)
    return { message: `${cur.name} has an election on file, so they can't be removed. Mark them not eligible instead.` };
  await prisma.$transaction(async (tx) => {
    await tx.employee.delete({ where: { id: cur.id } });
    await audit({ actor: user, action: "employee.delete", entity: "Employee", entityId: cur.id, groupId, before: cur }, tx);
  });
  revalidatePath(setupPath(groupId));
  return { ok: true, message: `Removed ${cur.name}.` };
}

// ------------------------------------------------------------------ plans

export async function createPlan(groupId: string): Promise<void> {
  const { user } = await brokerGroup(groupId);
  const count = await prisma.plan.count({ where: { groupId } });
  await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({ data: { groupId, name: "New plan", sortOrder: count } });
    await audit({ actor: user, action: "plan.create", entity: "Plan", entityId: plan.id, groupId, after: plan }, tx);
  });
  revalidatePath(setupPath(groupId));
}

export async function updatePlan(groupId: string, planId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await brokerGroup(groupId);
  const cur = await prisma.plan.findFirst({ where: { id: planId, groupId } });
  if (!cur) throw new Forbidden();
  const parsed = PlanInput.safeParse(formObject(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), message: "Please fix the highlighted fields.", values: formObject(fd) as Record<string, string> };
  await prisma.$transaction(async (tx) => {
    const after = await tx.plan.update({ where: { id: cur.id }, data: parsed.data });
    await audit({ actor: user, action: "plan.update", entity: "Plan", entityId: cur.id, groupId, before: cur, after }, tx);
  });
  revalidatePath(setupPath(groupId));
  return { ok: true, message: "Plan saved." };
}

export async function deletePlan(groupId: string, planId: string): Promise<FormState> {
  const { user } = await brokerGroup(groupId);
  const cur = await prisma.plan.findFirst({ where: { id: planId, groupId }, include: { _count: { select: { elections: true } } } });
  if (!cur) throw new Forbidden();
  if (cur._count.elections > 0)
    return { message: `"${cur.name}" has elections on file, so it can't be deleted. Election history has to keep pointing at it.` };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.plan.delete({ where: { id: cur.id } });
      await audit({ actor: user, action: "plan.delete", entity: "Plan", entityId: cur.id, groupId, before: cur }, tx);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return { message: "That plan couldn't be deleted. Try again." };
    throw e;
  }
  revalidatePath(setupPath(groupId));
  return { ok: true, message: `Deleted "${cur.name}".` };
}

import "server-only";
import { Prisma, type Election, type Employee, type EmployerGroup, type Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/authz";
import { cost } from "@/lib/domain/cost";
import { tierOf } from "@/lib/domain/tier";
import { windowState } from "@/lib/domain/window";
import { signatureMatches, type ElectionInput } from "@/lib/validation/election";

export class ElectionError extends Error {}

export const planRates = (p: Plan) => ({
  ee: Number(p.rateEe),
  es: Number(p.rateEs),
  ec: Number(p.rateEc),
  fam: Number(p.rateFam),
});
export const groupContribution = (g: EmployerGroup) => ({
  eePct: Number(g.eePct),
  depPct: Number(g.depPct),
  payPeriods: g.payPeriods,
});

type Ctx = {
  actor: SessionUser;
  employee: Employee & { group: EmployerGroup };
  source: "EMPLOYEE" | "ADMIN";
  ip?: string | null;
  userAgent?: string | null;
  adminNote?: string | null;
};

/**
 * Record a new election version. The only way elections are written.
 *  - EMPLOYEE: only inside the window, only for their own Employee row, signature must match their name.
 *  - ADMIN: any time; the admin's own name is the signature and a note is required. Audit-logged.
 * Costs are recomputed server-side from current rates. Previous versions are kept.
 */
export async function recordElection(input: ElectionInput, ctx: Ctx): Promise<Election> {
  const { employee, actor, source } = ctx;
  const group = employee.group;

  if (source === "EMPLOYEE") {
    if (actor.role !== "EMPLOYEE" || actor.employeeId !== employee.id) throw new ElectionError("You can only change your own election.");
    if (!windowState(group).open) throw new ElectionError("Enrollment is closed, so elections can't be changed right now.");
    if (!employee.eligible) throw new ElectionError("You aren't listed as eligible for benefits. Please contact your HR team.");
    if (!input.dob) throw new ElectionError("Please enter your date of birth.");
    if (!signatureMatches(input.signatureName, employee.name))
      throw new ElectionError(`Type your name exactly as "${employee.name}" to sign.`);
  } else {
    if (actor.role !== "BROKER_ADMIN" && actor.role !== "EMPLOYER_ADMIN") throw new ElectionError("Not allowed.");
    if (!ctx.adminNote?.trim()) throw new ElectionError("Add a note saying why you're entering this election (for example, a paper form).");
  }

  let plan: Plan | null = null;
  if (input.choice.kind === "plan") {
    plan = await prisma.plan.findFirst({ where: { id: input.choice.planId, groupId: group.id } });
    if (!plan) throw new ElectionError("That plan isn't offered to this group.");
  }

  const tier = plan ? tierOf(input.dependents) : "ee";
  const c = plan
    ? cost(planRates(plan), tier, groupContribution(group))
    : { premium: 0, employer: 0, employee: 0, perPaycheck: 0 };

  const data = {
    employeeId: employee.id,
    planId: plan?.id ?? null,
    status: plan ? ("ENROLLED" as const) : ("WAIVED" as const),
    tier,
    dependents: plan ? input.dependents : [],
    tobacco: input.tobacco,
    waiveReason: input.choice.kind === "waive" ? input.choice.reason : null,
    waiveNote: input.choice.kind === "waive" ? input.choice.note || null : null,
    premium: c.premium,
    employerShare: c.employer,
    employeeShare: c.employee,
    perPaycheck: c.perPaycheck,
    signatureName: source === "EMPLOYEE" ? input.signatureName.trim() : actor.name || actor.email || "Administrator",
    signedAt: new Date(),
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent?.slice(0, 400) ?? null,
    source,
    enteredById: actor.id,
    adminNote: source === "ADMIN" ? ctx.adminNote!.trim().slice(0, 500) : null,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const prev = await tx.election.findFirst({ where: { employeeId: employee.id }, orderBy: { version: "desc" } });
        const created = await tx.election.create({ data: { ...data, version: (prev?.version ?? 0) + 1 } });
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            ...(input.dob ? { dob: new Date(input.dob + "T00:00:00Z") } : {}),
            ...(input.phone ? { phone: input.phone } : {}),
          },
        });
        await audit(
          {
            actor,
            action: source === "ADMIN" ? "election.admin_enter" : prev ? "election.change" : "election.submit",
            entity: "Election",
            entityId: created.id,
            agencyId: group.agencyId,
            groupId: group.id,
            before: prev,
            after: created,
          },
          tx,
        );
        return created;
      });
    } catch (e) {
      // Two submits at once: the unique (employeeId, version) index rejects one; retry with the next version.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
  throw new ElectionError("Couldn't save. Please try again.");
}

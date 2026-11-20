import "server-only";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { employeesWithLatest, summarize } from "@/lib/server/groupStats";
import type { EmployerGroup } from "@prisma/client";

/** Everything the group dashboard and CSV export need, from latest election versions only. */
export async function dashboardData(group: EmployerGroup) {
  const [emps, plans] = await Promise.all([
    employeesWithLatest(group.id),
    prisma.plan.findMany({ where: { groupId: group.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const summary = summarize(group, emps);
  const enrolled = emps.filter((e) => e.eligible && e.latest?.status === "ENROLLED");
  const totals = enrolled.reduce(
    (a, e) => ({
      premium: a.premium + Number(e.latest!.premium),
      employer: a.employer + Number(e.latest!.employerShare),
      employee: a.employee + Number(e.latest!.employeeShare),
    }),
    { premium: 0, employer: 0, employee: 0 },
  );
  const byPlan = plans.map((p: Plan) => ({ plan: p, count: enrolled.filter((e) => e.latest!.planId === p.id).length }));
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  return { emps, plans, summary, totals, byPlan, planName };
}

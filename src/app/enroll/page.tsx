import { prisma } from "@/lib/db";
import { requireOwnEmployee } from "@/lib/authz";
import { windowState, isoDate, fmtDate } from "@/lib/domain/window";
import { cost } from "@/lib/domain/cost";
import { groupContribution, planRates } from "@/lib/server/elections";
import { EnrollWizard, type WizardPlan, type WizardStart } from "@/components/enroll/EnrollWizard";
import { Confirmation } from "@/components/enroll/Confirmation";
import type { Dependent } from "@/lib/domain/tier";

export const metadata = { title: "Enroll · Open Enrollment Studio" };

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ change?: string; submitted?: string }> }) {
  const { employee } = await requireOwnEmployee();
  const sp = await searchParams;
  const group = employee.group;
  const w = windowState(group);

  const [plans, latest, agency] = await Promise.all([
    prisma.plan.findMany({
      where: { groupId: group.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { explainers: { where: { status: { in: ["APPROVED", "RENDERING", "READY"] } }, take: 1, select: { id: true } } },
    }),
    prisma.election.findFirst({
      where: { employeeId: employee.id },
      orderBy: { version: "desc" },
      include: { plan: { select: { name: true } } },
    }),
    prisma.agency.findUniqueOrThrow({ where: { id: group.agencyId }, select: { name: true, contactEmail: true } }),
  ]);

  const contribution = groupContribution(group);
  const wizardPlans: WizardPlan[] = plans.map((p) => {
    const tiers = (["ee", "es", "ec", "fam"] as const).map((t) => [t, cost(planRates(p), t, contribution)] as const);
    return {
      id: p.id,
      name: p.name,
      carrier: p.carrier,
      type: p.type,
      facts: [
        ["Deductible", p.deductible],
        ["Out-of-pocket max", p.oop],
        ["Doctor visit", p.pcp],
        ["Coinsurance", p.coinsurance],
      ].filter(([, v]) => v) as [string, string][],
      cost: Object.fromEntries(tiers) as WizardPlan["cost"],
      hasExplainer: p.explainers.length > 0,
    };
  });

  if (latest && !sp.change) {
    return (
      <Confirmation
        justSubmitted={!!sp.submitted}
        windowOpen={w.open}
        windowLabel={w.label}
        effectiveDate={fmtDate(group.effectiveDate)}
        agency={agency}
        election={{
          status: latest.status,
          planName: latest.plan?.name ?? null,
          planId: latest.planId,
          tier: latest.tier,
          perPaycheck: Number(latest.perPaycheck),
          employeeMonthly: Number(latest.employeeShare),
          dependents: (latest.dependents as Dependent[]) ?? [],
          waiveReason: latest.waiveReason,
          waiveNote: latest.waiveNote,
          signedAt: latest.signedAt.toISOString(),
          enteredByAdmin: latest.source === "ADMIN",
          hasExplainer: !!wizardPlans.find((p) => p.id === latest.planId)?.hasExplainer,
        }}
      />
    );
  }

  const start: WizardStart = {
    dob: employee.dob ? isoDate(employee.dob) : "",
    phone: employee.phone ?? "",
    tobacco: latest?.tobacco ?? false,
    dependents: (latest?.dependents as Dependent[]) ?? [],
    choice: latest ? (latest.planId ? { kind: "plan", planId: latest.planId } : { kind: "waive", reason: latest.waiveReason ?? "", note: latest.waiveNote ?? "" }) : null,
  };

  return (
    <EnrollWizard
      employee={{ name: employee.name, email: employee.email, hireDate: employee.hireDate ? fmtDate(employee.hireDate) : null, eligible: employee.eligible }}
      group={{
        name: group.name,
        planYear: group.planYear,
        effectiveDate: fmtDate(group.effectiveDate),
        windowStart: fmtDate(group.windowStart),
        windowEnd: fmtDate(group.windowEnd),
        payPeriods: group.payPeriods,
        windowOpen: w.open,
        windowLabel: w.label,
      }}
      plans={wizardPlans}
      start={start}
      changing={!!latest}
    />
  );
}

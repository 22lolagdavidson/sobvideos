import { requireAdminGroup } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { isoDate } from "@/lib/domain/window";
import { GroupForm } from "@/components/setup/GroupForm";
import { RosterImport } from "@/components/setup/RosterImport";
import { RosterTable, type RosterEmployee } from "@/components/setup/RosterTable";
import { PlanEditor } from "@/components/setup/PlanEditor";
import { employeesWithLatest } from "@/lib/server/groupStats";
import { createPlan, deletePlan, importRoster, removeEmployee, saveEmployee, updateGroup, updatePlan } from "./actions";

export const metadata = { title: "Group setup · Open Enrollment Studio" };

export default async function SetupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { user, group } = await requireAdminGroup(groupId);
  const isBroker = user.role === "BROKER_ADMIN";

  const [emps, plans] = await Promise.all([
    employeesWithLatest(group.id),
    prisma.plan.findMany({
      where: { groupId: group.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { elections: true } },
        explainers: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
  ]);

  const roster: RosterEmployee[] = emps.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    hireDate: e.hireDate ? isoDate(e.hireDate) : "",
    eligible: e.eligible,
    status: e.latest?.status ?? null,
    signedIn: !!e.userId,
  }));

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h2>Group details</h2>
      </div>
      <GroupForm
        action={updateGroup.bind(null, group.id)}
        canEdit={isBroker}
        submitLabel="Save group details"
        values={{
          name: group.name,
          planYear: group.planYear,
          effectiveDate: isoDate(group.effectiveDate),
          windowStart: isoDate(group.windowStart),
          windowEnd: isoDate(group.windowEnd),
          payPeriods: group.payPeriods,
          eePct: Number(group.eePct),
          depPct: Number(group.depPct),
          participationTarget: Number(group.participationTarget),
        }}
      />

      <div className="section-title">
        <h2>Employees</h2>
      </div>
      <div className="grid" style={{ gap: 16 }}>
        <RosterImport action={importRoster.bind(null, group.id)} />
        <RosterTable employees={roster} save={saveEmployee.bind(null, group.id)} remove={removeEmployee.bind(null, group.id)} />
      </div>

      <div className="section-title">
        <h2>Plans</h2>
        <div className="spacer" />
        {isBroker && (
          <form action={createPlan.bind(null, group.id)}>
            <button className="btn" type="submit">
              + Add a plan
            </button>
          </form>
        )}
      </div>
      {plans.length === 0 && <div className="card muted">No plans yet. Add one, then upload its SBC in step 4.</div>}
      <div className="grid">
        {plans.map((p) => (
          <PlanEditor
            key={p.id}
            canEdit={isBroker}
            save={updatePlan.bind(null, group.id, p.id)}
            remove={deletePlan.bind(null, group.id, p.id)}
            plan={{
              id: p.id,
              name: p.name,
              carrier: p.carrier,
              type: p.type,
              deductible: p.deductible,
              deductibleFam: p.deductibleFam,
              oop: p.oop,
              oopFam: p.oopFam,
              coinsurance: p.coinsurance,
              pcp: p.pcp,
              specialist: p.specialist,
              urgent: p.urgent,
              er: p.er,
              rx: p.rx,
              rateEe: p.rateEe.toString(),
              rateEs: p.rateEs.toString(),
              rateEc: p.rateEc.toString(),
              rateFam: p.rateFam.toString(),
              electionCount: p._count.elections,
              explainerStatus: p.explainers[0]?.status ?? null,
            }}
          />
        ))}
      </div>
    </div>
  );
}

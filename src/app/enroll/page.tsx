import { requireOwnEmployee } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { windowState } from "@/lib/domain/window";
import { TIERS } from "@/lib/domain/constants";

export const metadata = { title: "Enroll · Open Enrollment Studio" };

export default async function EnrollHome() {
  const { employee } = await requireOwnEmployee();
  const w = windowState(employee.group);
  const latest = await prisma.election.findFirst({
    where: { employeeId: employee.id },
    orderBy: { version: "desc" },
    include: { plan: { select: { name: true } } },
  });
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="row">
        <h1 style={{ margin: 0 }}>Hi, {employee.name.split(" ")[0]}!</h1>
        <span className={`pill ${w.key}`}>{w.label}</span>
      </div>
      <p className="muted">
        {employee.group.name} · {employee.group.planYear} benefits
      </p>
      {latest ? (
        <p className="notice ok">
          Your current election:{" "}
          {latest.status === "ENROLLED" ? `${latest.plan?.name ?? "Plan"}, ${TIERS[latest.tier]}` : "Waived coverage"}.
        </p>
      ) : (
        <p className="notice">You haven&apos;t made an election yet.</p>
      )}
      <p className="small muted">The enrollment wizard arrives in step 3.</p>
    </div>
  );
}

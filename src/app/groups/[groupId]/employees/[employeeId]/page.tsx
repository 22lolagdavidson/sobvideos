import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminGroup } from "@/lib/authz";
import { money } from "@/lib/domain/cost";
import { TIERS, WAIVE_REASONS } from "@/lib/domain/constants";
import { isoDate } from "@/lib/domain/window";
import type { Dependent } from "@/lib/domain/tier";
import { AdminElectionForm } from "@/components/dashboard/AdminElectionForm";
import { adminEnterElection } from "./actions";

export default async function EmployeeElections({ params }: { params: Promise<{ groupId: string; employeeId: string }> }) {
  const { groupId, employeeId } = await params;
  const { group } = await requireAdminGroup(groupId);
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, groupId: group.id },
    include: { elections: { orderBy: { version: "desc" }, include: { plan: { select: { name: true } } } } },
  });
  if (!employee) notFound();
  const plans = await prisma.plan.findMany({ where: { groupId: group.id }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true } });
  const latest = employee.elections[0];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <p className="small" style={{ margin: 0 }}>
        <Link href={`/groups/${group.id}`}>← Dashboard</Link>
      </p>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>{employee.name}</h2>
        <div className="small muted">
          {employee.email} · hired {employee.hireDate ? isoDate(employee.hireDate) : "—"} · {employee.eligible ? "eligible" : "not eligible"}
          {employee.userId ? " · has signed in" : ""}
        </div>
      </div>

      <div className="card tablewrap">
        <h3>Election history</h3>
        {employee.elections.length === 0 ? (
          <p className="muted">No election yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Signed</th>
                <th scope="col">Election</th>
                <th scope="col">Coverage</th>
                <th scope="col">Per paycheck</th>
                <th scope="col">Signed by</th>
              </tr>
            </thead>
            <tbody>
              {employee.elections.map((e, i) => (
                <tr key={e.id}>
                  <td>
                    v{e.version} {i === 0 && <span className="badge enrolled">current</span>}
                  </td>
                  <td className="small">{e.signedAt.toISOString().replace("T", " ").slice(0, 16)} UTC</td>
                  <td>
                    {e.status === "ENROLLED" ? e.plan?.name : `Waived: ${e.waiveReason ? WAIVE_REASONS[e.waiveReason] : ""}`}
                    {e.waiveNote && <div className="small muted">{e.waiveNote}</div>}
                  </td>
                  <td>
                    {e.status === "ENROLLED" ? TIERS[e.tier] : "—"}
                    {((e.dependents as Dependent[]) ?? []).map((x, j) => (
                      <div key={j} className="small muted">
                        {x.name} ({x.relationship}, {x.dob})
                      </div>
                    ))}
                  </td>
                  <td>{e.status === "ENROLLED" ? money(e.perPaycheck) : "—"}</td>
                  <td className="small">
                    {e.signatureName}
                    <div className="muted">{e.source === "ADMIN" ? `Admin entry: ${e.adminNote ?? ""}` : "Employee e-signature"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminElectionForm
        plans={plans}
        action={adminEnterElection.bind(null, group.id, employee.id)}
        start={{
          choice: latest ? (latest.planId ?? "waive") : "",
          waiveReason: latest?.waiveReason ?? "",
          waiveNote: latest?.waiveNote ?? "",
          dependents: (latest?.dependents as Dependent[]) ?? [],
          tobacco: latest?.tobacco ?? false,
          dob: employee.dob ? isoDate(employee.dob) : "",
        }}
      />
    </div>
  );
}

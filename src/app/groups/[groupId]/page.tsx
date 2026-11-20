import Link from "next/link";
import { requireAdminGroup } from "@/lib/authz";
import { dashboardData } from "@/lib/server/dashboard";
import { money } from "@/lib/domain/cost";
import { TIERS, WAIVE_REASONS } from "@/lib/domain/constants";
import { RemindButton } from "@/components/dashboard/RemindButton";
import { remindPending } from "./actions";

export const metadata = { title: "Group dashboard · Open Enrollment Studio" };

export default async function GroupDashboard({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { group } = await requireAdminGroup(groupId);
  const { emps, summary: s, totals, byPlan, planName } = await dashboardData(group);
  const pct = s.participation.pct;
  const target = Number(group.participationTarget);
  const met = pct != null && pct >= target;

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Enrollment dashboard</h2>
        <div className="spacer" />
        <RemindButton count={s.pending} action={remindPending.bind(null, group.id)} />
        <a className="btn" href={`/groups/${group.id}/export`} download>
          ⬇ Download CSV
        </a>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="n">{s.eligible}</div>
          <div className="l">Eligible employees</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: "#13744f" }}>
            {s.enrolled}
          </div>
          <div className="l">Enrolled</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: "#5b3d99" }}>
            {s.waived}
          </div>
          <div className="l">Waived ({s.participation.waivedOtherCoverage} with other coverage)</div>
        </div>
        <div className="card stat">
          <div className="n" style={{ color: "#7a5200" }}>
            {s.pending}
          </div>
          <div className="l">Haven&apos;t responded</div>
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Participation: {pct == null ? "—" : `${Math.round(pct)}%`}</h3>
          <div className="bar" role="img" aria-label={`Participation ${pct == null ? "not available" : Math.round(pct) + "%"}, target ${target}%`}>
            <i style={{ width: `${Math.min(100, pct ?? 0)}%`, background: met ? "var(--good)" : "var(--warn)" }} />
            <span className="target" style={{ left: `${Math.min(100, target)}%` }} />
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {s.enrolled} enrolled ÷ ({s.eligible} eligible − {s.participation.waivedOtherCoverage} waived with other coverage). Your target is {target}
            %: {met ? <b style={{ color: "#13744f" }}>met</b> : <b style={{ color: "#7a5200" }}>not met yet</b>}. Participation rules vary by
            carrier, so confirm how each carrier counts waivers.
          </p>
        </div>
        <div className="card">
          <h3>Monthly premium (enrolled)</h3>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", margin: 0 }}>
            <dt className="muted">Total premium</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{money(totals.premium)}</dd>
            <dt className="muted">Employer share</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{money(totals.employer)}</dd>
            <dt className="muted">Employee payroll deductions</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{money(totals.employee)}</dd>
          </dl>
          <div className="small muted" style={{ marginTop: 8 }}>
            {byPlan.map((x) => `${x.plan.name}: ${x.count}`).join(" · ") || "No plans yet"}
          </div>
          <div className="small muted">Amounts are as of each employee&apos;s signature.</div>
        </div>
      </div>

      <div className="card tablewrap">
        <table>
          <caption className="sr-only">Roster with each employee&apos;s current election</caption>
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Status</th>
              <th scope="col">Plan</th>
              <th scope="col">Coverage</th>
              <th scope="col">Per paycheck</th>
              <th scope="col">Submitted</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {emps.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No employees on the roster yet. Add them in <Link href={`/groups/${group.id}/setup`}>Setup</Link>.
                </td>
              </tr>
            )}
            {emps.map((e) => {
              const l = e.latest;
              const deps = ((l?.dependents as unknown[]) ?? []).length;
              const status = !e.eligible ? "not eligible" : l ? (l.status === "ENROLLED" ? "enrolled" : "waived") : "pending";
              return (
                <tr key={e.id}>
                  <td>
                    <b>{e.name}</b>
                    <div className="small muted">{e.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${status === "not eligible" ? "" : status}`}>{status}</span>
                    {l?.source === "ADMIN" && <div className="small muted">entered by admin</div>}
                  </td>
                  <td>
                    {l?.status === "ENROLLED" ? (
                      planName.get(l.planId ?? "")
                    ) : l?.status === "WAIVED" ? (
                      <span className="small">{l.waiveReason ? WAIVE_REASONS[l.waiveReason] : ""}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{l?.status === "ENROLLED" ? `${TIERS[l.tier]}${deps ? ` (${deps} dep.)` : ""}` : "—"}</td>
                  <td>{l?.status === "ENROLLED" ? money(l.perPaycheck) : "—"}</td>
                  <td className="small">{l ? l.signedAt.toLocaleDateString("en-US", { timeZone: "UTC" }) : "—"}</td>
                  <td>
                    <Link className="btn sm ghost" href={`/groups/${group.id}/employees/${e.id}`} aria-label={`Election details for ${e.name}`}>
                      {l ? "Details" : "Enter election"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

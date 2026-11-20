import Link from "next/link";
import { notFound } from "next/navigation";
import { groupScope, requireUser } from "@/lib/authz";
import { groupSummaries } from "@/lib/server/groupStats";
import { fmtDate } from "@/lib/domain/window";

export const metadata = { title: "Groups · Open Enrollment Studio" };

export default async function BrokerDashboard() {
  const user = await requireUser();
  if (user.role !== "BROKER_ADMIN") notFound();
  const groups = await groupSummaries(groupScope(user));

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Employer groups</h1>
        <div className="spacer" />
        {/* Group creation arrives in step 2 */}
      </div>
      {groups.length === 0 ? (
        <div className="card">No groups yet.</div>
      ) : (
        <div className="card tablewrap">
          <table>
            <caption className="sr-only">Employer groups with enrollment status</caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Plan year</th>
                <th scope="col">Enrollment window</th>
                <th scope="col">Participation</th>
                <th scope="col">Pending</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((s) => {
                const pct = s.participation.pct;
                const target = Number(s.group.participationTarget);
                return (
                  <tr key={s.group.id}>
                    <td>
                      <Link href={`/groups/${s.group.id}`} style={{ fontWeight: 600 }}>
                        {s.group.name}
                      </Link>
                    </td>
                    <td>
                      {s.group.planYear}
                      <div className="small muted">Effective {fmtDate(s.group.effectiveDate)}</div>
                    </td>
                    <td>
                      <span className={`pill ${s.window.key}`}>{s.window.label}</span>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <div className="row small" style={{ justifyContent: "space-between" }}>
                        <b>{pct == null ? "—" : `${Math.round(pct)}%`}</b>
                        <span className="muted">target {target}%</span>
                      </div>
                      <div
                        className="bar"
                        role="img"
                        aria-label={`Participation ${pct == null ? "not available" : Math.round(pct) + "%"}, target ${target}%`}
                      >
                        <i style={{ width: `${Math.min(100, pct ?? 0)}%`, background: (pct ?? 0) >= target ? "var(--good)" : "var(--warn)" }} />
                        <span className="target" style={{ left: `${Math.min(100, target)}%` }} />
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.pending ? "pending" : "enrolled"}`}>{s.pending} pending</span>
                      <div className="small muted">
                        {s.enrolled} enrolled · {s.waived} waived of {s.eligible}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        Participation = enrolled ÷ (eligible − waivers with other group or government coverage). Participation rules vary
        by carrier.
      </p>
    </div>
  );
}

import { requireAdminGroup } from "@/lib/authz";
import { employeesWithLatest, summarize } from "@/lib/server/groupStats";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { group } = await requireAdminGroup(groupId);
  const s = summarize(group, await employeesWithLatest(group.id));
  return (
    <div>
      <div className="grid g4">
        {[
          ["Eligible", s.eligible],
          ["Enrolled", s.enrolled],
          ["Waived", s.waived],
          ["Pending", s.pending],
        ].map(([l, n]) => (
          <div key={l} className="card stat">
            <div className="n">{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>
      <p className="notice" style={{ marginTop: 16 }}>
        The full dashboard (roster, monthly totals, CSV export, reminders) arrives in step 3.
      </p>
    </div>
  );
}

import Link from "next/link";
import { requireAdminGroup } from "@/lib/authz";
import { windowState } from "@/lib/domain/window";
import { SubNav } from "@/components/SubNav";

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { user, group } = await requireAdminGroup(groupId);
  const w = windowState(group);
  return (
    <div>
      {user.role === "BROKER_ADMIN" && (
        <p className="small" style={{ margin: "0 0 6px" }}>
          <Link href="/broker">← All groups</Link>
        </p>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{group.name}</h1>
        <span className={`pill ${w.key}`}>{w.label}</span>
        <span className="muted small">{group.planYear} plan year</span>
      </div>
      <SubNav
        links={[
          { href: `/groups/${group.id}`, label: "Dashboard", exact: true },
          { href: `/groups/${group.id}/setup`, label: "Setup" },
        ]}
      />
      {children}
    </div>
  );
}

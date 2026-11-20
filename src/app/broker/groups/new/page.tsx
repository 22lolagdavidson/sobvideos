import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { GroupForm } from "@/components/setup/GroupForm";
import { createGroup } from "@/app/groups/[groupId]/setup/actions";

export const metadata = { title: "New group · Open Enrollment Studio" };

export default async function NewGroup() {
  const user = await requireUser();
  if (user.role !== "BROKER_ADMIN") notFound();
  const y = new Date().getUTCFullYear() + 1;
  return (
    <div style={{ maxWidth: 900 }}>
      <p className="small" style={{ margin: "0 0 6px" }}>
        <Link href="/broker">← All groups</Link>
      </p>
      <h1>New employer group</h1>
      <p className="muted">Start with the basics. You&apos;ll add employees and plans on the next screen.</p>
      <GroupForm
        action={createGroup}
        canEdit
        submitLabel="Create group"
        values={{
          name: "",
          planYear: y,
          effectiveDate: `${y}-01-01`,
          windowStart: "",
          windowEnd: "",
          payPeriods: 26,
          eePct: 50,
          depPct: 0,
          participationTarget: 70,
        }}
      />
    </div>
  );
}

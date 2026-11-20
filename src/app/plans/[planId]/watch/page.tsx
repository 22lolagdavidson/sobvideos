import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { groupScope, requireUser } from "@/lib/authz";

/** Placeholder until step 4 adds the Remotion player. Only approved explainers are ever shown. */
export default async function WatchPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const user = await requireUser();
  const plan = await prisma.plan.findFirst({
    where: { id: planId, group: groupScope(user) },
    include: { explainers: { where: { status: { in: ["APPROVED", "RENDERING", "READY"] } }, take: 1 } },
  });
  if (!plan || !plan.explainers.length) notFound();
  return (
    <div className="card">
      <h1>{plan.name} explained</h1>
      <p className="muted">The Penny &amp; Patch video player arrives in step 4.</p>
      <Link href="/enroll">← Back to enrollment</Link>
    </div>
  );
}

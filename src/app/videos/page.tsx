import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { STATUS_LABEL } from "@/lib/explainer/status";

export const metadata = { title: "Videos · Explainer Studio" };

export default async function VideosPage() {
  const user = await requireUser();
  const plans = await prisma.plan.findMany({
    where: { agencyId: user.agencyId },
    orderBy: { updatedAt: "desc" },
    include: {
      explainers: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      _count: { select: { explainers: { where: { status: "READY" } } } },
    },
  });

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row">
        <div>
          <h1 style={{ margin: 0 }}>Explainer videos</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Upload a plan&apos;s Schedule of Benefits or SBC and Penny &amp; Patch will explain it in a short video.
          </p>
        </div>
        <div className="spacer" />
        <Link href="/videos/new" className="btn primary">
          + New video
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h2>No videos yet</h2>
          <p className="muted">Start by uploading a Schedule of Benefits or SBC PDF.</p>
          <Link href="/videos/new" className="btn primary">
            Upload a plan document
          </Link>
        </div>
      ) : (
        <div className="vlist">
          {plans.map((p) => {
            const s = STATUS_LABEL[p.explainers[0]?.status ?? "NONE"];
            return (
              <Link key={p.id} href={`/videos/${p.id}`} className="card vrow">
                <div style={{ flex: 1 }}>
                  <h2>{p.name}</h2>
                  <div className="small muted">
                    {[p.carrier, p.type === "HDHP_HSA" ? "HDHP/HSA" : p.type === "Other" ? "" : p.type, p.planYear && `Plan year ${p.planYear}`]
                      .filter(Boolean)
                      .join(" · ") || "Plan details fill in after the script is written"}
                  </div>
                </div>
                {p._count.explainers > 0 && p.explainers[0]?.status !== "READY" && <span className="badge enrolled">Video available</span>}
                <span className={`badge ${s.cls}`}>{s.text}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

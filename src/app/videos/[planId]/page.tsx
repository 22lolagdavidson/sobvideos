import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePlan } from "@/lib/authz";
import type { NumberIssue } from "@/lib/explainer/numberCheck";
import { ExplainerScript } from "@/lib/explainer/schema";
import { STATUS_LABEL } from "@/lib/explainer/status";
import { ScriptEditor } from "@/components/video/ScriptEditor";
import { AutoRefresh, DeletePlan, GenerateButton, RenameForm, ReplaceForm, RetryButton } from "./PlanControls";

type Check = { issues: NumberIssue[]; confirmed: string[]; vision?: boolean };

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default async function PlanVideoPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ uploaded?: string }> }) {
  const { planId } = await params;
  const { uploaded } = await searchParams;
  const { user, plan } = await requirePlan(planId);
  const [agency, doc, latest, ready] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } }),
    prisma.benefitDocument.findFirst({ where: { planId }, orderBy: { createdAt: "desc" } }),
    prisma.explainer.findFirst({ where: { planId }, orderBy: { createdAt: "desc" } }),
    prisma.explainer.findFirst({ where: { planId, status: "READY" }, orderBy: { createdAt: "desc" } }),
  ]);
  const script = latest ? ExplainerScript.safeParse(latest.script) : null;
  const check = (latest?.numberCheck as Check | null) ?? { issues: [], confirmed: [] };
  const agencyProps = { name: agency.name, logoUrl: agency.logoKey ? `/api/files/logo?v=${agency.updatedAt.getTime()}` : null };
  const typeLabel = plan.type === "HDHP_HSA" ? "HDHP/HSA" : plan.type === "Other" ? "" : plan.type;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Link href="/videos" className="small">
        ← All videos
      </Link>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0 }}>{plan.name}</h1>
          <div className="muted">{[plan.carrier, typeLabel, plan.planYear && `Plan year ${plan.planYear}`].filter(Boolean).join(" · ")}</div>
        </div>
        {latest && <span className={`badge ${STATUS_LABEL[latest.status].cls}`}>{STATUS_LABEL[latest.status].text}</span>}
      </div>

      {uploaded && doc?.status === "EXTRACTED" && !latest && (
        <div className="notice ok" role="status">
          Got it. {doc.extractedText ? "We read the text in your PDF." : "This PDF looks scanned, so Claude will read the page images instead."} Next, have Claude write the script.
        </div>
      )}

      {/* ---------------- finished video */}
      {ready?.mp4Key && (
        <section className="card" aria-labelledby="video-h">
          <div className="row">
            <h2 id="video-h" style={{ margin: 0 }}>
              Video
            </h2>
            <div className="spacer" />
            {ready.durationSec && <span className="small muted">{fmtDur(ready.durationSec)}</span>}
          </div>
          {latest && latest.id !== ready.id && (
            <p className="small muted">This is the last rendered video. Your newer script below hasn&apos;t been rendered yet.</p>
          )}
          <div className="video-wrap" style={{ marginTop: 12 }}>
            <video controls preload="metadata" src={`/api/files/explainer/${ready.id}/video.mp4`} crossOrigin="use-credentials">
              {ready.captionsKey && <track kind="captions" src={`/api/files/explainer/${ready.id}/captions.vtt`} srcLang="en" label="English" default />}
            </video>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn primary" href={`/api/files/explainer/${ready.id}/video.mp4?download=1`}>
              Download MP4
            </a>
            {ready.captionsKey && (
              <a className="btn" href={`/api/files/explainer/${ready.id}/captions.vtt?download=1`}>
                Download captions (.vtt)
              </a>
            )}
            <span className="small muted">Captions are burned into the MP4 too.</span>
          </div>
        </section>
      )}

      {latest?.status === "RENDERING" && (
        <div className="notice" role="status">
          <strong>Rendering the video.</strong> Recording Penny and Patch&apos;s voices and drawing every frame. This usually takes a few minutes, and this page updates on its own.
          <AutoRefresh seconds={5} />
        </div>
      )}
      {latest?.status === "FAILED" && (
        <div className="notice err" role="alert">
          <strong>The render failed.</strong> {latest.renderError}
          <div style={{ marginTop: 8 }}>
            <RetryButton explainerId={latest.id} />
          </div>
        </div>
      )}

      {/* ---------------- document + generate */}
      <div className="grid g2">
        <section className="card" aria-labelledby="doc-h">
          <h2 id="doc-h" style={{ marginTop: 0 }}>
            Plan document
          </h2>
          {doc ? (
            <>
              <p style={{ margin: "0 0 4px" }}>
                <a href={`/api/files/document/${doc.id}`} target="_blank" rel="noopener">
                  {doc.fileName}
                </a>
              </p>
              <div className="small muted">
                {[doc.pageCount && `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}`, fmtSize(doc.fileSize), `uploaded ${doc.createdAt.toLocaleDateString("en-US")}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {doc.status === "FAILED" && <div className="notice err small" style={{ marginTop: 8 }}>We couldn&apos;t read this PDF ({doc.error}). Try uploading it again.</div>}
              {doc.status === "EXTRACTED" && !doc.extractedText && (
                <div className="notice warn small" style={{ marginTop: 8 }}>
                  This PDF has no text layer (it looks scanned), so Claude reads the page images. Every number will be flagged for you to check against the document.
                </div>
              )}
            </>
          ) : (
            <p className="muted">No document uploaded.</p>
          )}
          <details style={{ marginTop: 12 }}>
            <summary className="small" style={{ cursor: "pointer" }}>
              Upload a different document
            </summary>
            <ReplaceForm planId={plan.id} />
          </details>
        </section>

        <section className="card" aria-labelledby="gen-h">
          <h2 id="gen-h" style={{ marginTop: 0 }}>
            Script
          </h2>
          <p className="muted small">
            Claude writes a short conversation between Penny and Patch, using only the numbers in the document. It never recommends a plan or mentions premiums.
          </p>
          {doc?.status === "EXTRACTED" ? (
            <GenerateButton planId={plan.id} again={!!latest} />
          ) : (
            <p className="small muted">Upload a readable PDF first.</p>
          )}
        </section>
      </div>

      {/* ---------------- review */}
      {latest && script?.success && (
        <ScriptEditor
          key={latest.id}
          explainerId={latest.id}
          status={latest.status}
          script={script.data}
          issues={check.issues}
          confirmed={check.confirmed}
          vision={!!check.vision}
          agency={agencyProps}
          planYear={plan.planYear || undefined}
        />
      )}
      {latest && script && !script.success && <div className="notice err">This script couldn&apos;t be loaded. Write a new one.</div>}

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Plan settings</summary>
        <div style={{ marginTop: 12 }}>
          <RenameForm planId={plan.id} name={plan.name} planYear={plan.planYear} />
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
          <DeletePlan planId={plan.id} name={plan.name} />
        </div>
      </details>
    </div>
  );
}

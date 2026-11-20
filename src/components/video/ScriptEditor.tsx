"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExplainerScript, Scene, Visual } from "@/lib/explainer/schema";
import type { NumberIssue } from "@/lib/explainer/numberCheck";
import { approveAndRender, saveScript, setNumberConfirmed } from "@/app/videos/actions";
import { Preview } from "./Preview";

const KIND_LABEL: Record<string, string> = {
  title: "Title",
  meter: "Deductible jar",
  prices: "Copay price tags",
  split: "Coinsurance split",
  shield: "Out-of-pocket max shield",
  story: "Coverage example receipt",
  "list:good": "Covered services",
  "list:bad": "Not covered",
  "list:recap": "Recap: numbers to remember",
  quiz: "Quiz",
};
const label = (v: Visual) => KIND_LABEL[v.kind === "list" ? `list:${v.tone}` : v.kind];

type Props = {
  explainerId: string;
  status: string;
  script: ExplainerScript;
  issues: NumberIssue[];
  confirmed: string[];
  vision: boolean;
  agency: { name: string; logoUrl?: string | null };
  planYear?: string;
};

function Text({ label, value, onChange, max, wide }: { label: string; value: string; onChange: (v: string) => void; max: number; wide?: boolean }) {
  return (
    <label className="f" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      {label}
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Edits a scene's visual fields. Each kind gets the fields it needs. */
function VisualFields({ v, set }: { v: Visual; set: (v: Visual) => void }) {
  const up = <T extends Visual>(patch: Partial<T>) => set({ ...(v as T), ...patch });
  const rows = (items: { label: string; amount: string }[], key: "items" | "rows", max: number) => (
    <div style={{ gridColumn: "1 / -1" }}>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input aria-label={`Row ${i + 1} label`} value={it.label} maxLength={60} onChange={(e) => up({ [key]: items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } as Partial<Visual>)} style={{ flex: 2 }} className="inp" />
          <input aria-label={`Row ${i + 1} amount`} value={it.amount} maxLength={40} onChange={(e) => up({ [key]: items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) } as Partial<Visual>)} style={{ flex: 1 }} className="inp" />
          <button type="button" className="btn sm ghost danger" disabled={items.length <= 1} onClick={() => up({ [key]: items.filter((_, j) => j !== i) } as Partial<Visual>)} aria-label={`Remove row ${i + 1}`}>
            ✕
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn sm" onClick={() => up({ [key]: [...items, { label: "", amount: "" }] } as Partial<Visual>)}>
          + Add row
        </button>
      )}
    </div>
  );
  switch (v.kind) {
    case "title":
      return (
        <>
          <Text label="Title" value={v.title} max={80} onChange={(t) => up({ title: t })} />
          <Text label="Subtitle" value={v.subtitle} max={160} onChange={(t) => up({ subtitle: t })} />
        </>
      );
    case "meter":
    case "shield":
      return (
        <>
          <Text label="Label" value={v.label} max={40} onChange={(t) => up({ label: t })} />
          <Text label="Amount" value={v.amount} max={40} onChange={(t) => up({ amount: t })} />
          <Text label="Note" value={v.note} max={v.kind === "meter" ? 160 : 200} onChange={(t) => up({ note: t })} wide />
        </>
      );
    case "prices":
      return (
        <>
          <Text label="Heading" value={v.title} max={60} onChange={(t) => up({ title: t })} wide />
          {rows(v.items, "items", 5)}
        </>
      );
    case "story":
      return (
        <>
          <Text label="Example title" value={v.title} max={80} onChange={(t) => up({ title: t })} />
          <Text label="Total you'd pay" value={v.total} max={40} onChange={(t) => up({ total: t })} />
          {rows(v.rows, "rows", 6)}
        </>
      );
    case "split":
      return (
        <>
          <Text label="Heading" value={v.title} max={60} onChange={(t) => up({ title: t })} />
          <label className="f">
            You pay (%)
            <input
              type="number"
              min={0}
              max={100}
              value={v.you}
              onChange={(e) => {
                const you = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                up({ you, plan: 100 - you });
              }}
            />
          </label>
          <div className="small muted" style={{ alignSelf: "center" }}>
            The plan pays {v.plan}%
          </div>
        </>
      );
    case "list":
      return (
        <>
          <Text label="Heading" value={v.title} max={60} onChange={(t) => up({ title: t })} wide />
          <div style={{ gridColumn: "1 / -1" }}>
            {v.items.map((it, i) => (
              <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input aria-label={`Item ${i + 1}`} className="inp" value={it} maxLength={120} style={{ flex: 1 }} onChange={(e) => up({ items: v.items.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="btn sm ghost danger" disabled={v.items.length <= 1} onClick={() => up({ items: v.items.filter((_, j) => j !== i) })} aria-label={`Remove item ${i + 1}`}>
                  ✕
                </button>
              </div>
            ))}
            {v.items.length < 6 && (
              <button type="button" className="btn sm" onClick={() => up({ items: [...v.items, ""] })}>
                + Add item
              </button>
            )}
          </div>
        </>
      );
    case "quiz":
      return (
        <>
          <Text label="Question" value={v.question} max={200} onChange={(t) => up({ question: t })} wide />
          <fieldset style={{ gridColumn: "1 / -1" }}>
            <legend className="small muted" style={{ fontWeight: 600 }}>
              Answers (pick the right one)
            </legend>
            {v.options.map((o, i) => (
              <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input type="radio" name={`answer-${v.question}`} checked={v.answer === i} onChange={() => up({ answer: i })} aria-label={`Option ${String.fromCharCode(65 + i)} is correct`} />
                <input aria-label={`Option ${String.fromCharCode(65 + i)}`} className="inp" value={o} maxLength={100} style={{ flex: 1 }} onChange={(e) => up({ options: v.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              </div>
            ))}
          </fieldset>
        </>
      );
  }
}

export function ScriptEditor({ explainerId, status, script: initial, issues, confirmed, vision, agency, planYear }: Props) {
  const router = useRouter();
  const [script, setScript] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const draft = status === "DRAFT";
  const open = issues.filter((i) => !confirmed.includes(i.key));

  const setScene = (i: number, sc: Scene) => {
    setScript((s) => ({ ...s, scenes: s.scenes.map((x, j) => (j === i ? sc : x)) }));
    setDirty(true);
  };
  const flagged = useMemo(() => new Set(issues.flatMap((i) => i.where.map((w) => w.split(" · ")[0]))), [issues]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message ? { ok: r.ok, text: r.message } : null);
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div>
          <Preview script={script} agency={agency} planYear={planYear} />
        </div>
        <div className="card">
          <h3>Number check</h3>
          {vision && (
            <p className="notice warn small">
              This PDF is a scanned image, so Claude read the page pictures and there&apos;s no text to check against. Every number below needs your
              confirmation against the document.
            </p>
          )}
          {issues.length === 0 ? (
            <p className="notice ok" style={{ margin: 0 }}>
              ✓ Every dollar amount and percentage in the script appears in the document.
            </p>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                These amounts aren&apos;t in the document text. Fix them in the script, or confirm each one after checking the document yourself.
                Approval is blocked until all are resolved.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {issues.map((i) => {
                  const ok = confirmed.includes(i.key);
                  return (
                    <li key={i.key} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "6px 0", flexWrap: "nowrap" }}>
                      <span>
                        <b style={{ color: ok ? "#13744f" : "#a12424" }}>{i.display}</b> <span className="small muted">{i.where.join(", ")}</span>
                      </span>
                      {draft && (
                        <label className="small row" style={{ gap: 6, flexWrap: "nowrap", fontWeight: 600 }}>
                          <input type="checkbox" checked={ok} disabled={busy || dirty} onChange={(e) => run(() => setNumberConfirmed(explainerId, i.key, e.target.checked))} />
                          Correct
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {draft && (
            <div className="row" style={{ marginTop: 14 }}>
              <button
                className="btn primary"
                type="button"
                disabled={busy || dirty || open.length > 0}
                onClick={() => {
                  if (window.confirm("Approve this script and render the video?")) run(() => approveAndRender(explainerId));
                }}
              >
                ✓ Approve &amp; render video
              </button>
              <span className="small muted">
                {dirty ? "Save your edits first." : open.length ? `${open.length} number${open.length === 1 ? "" : "s"} to check.` : "Ready to approve."}
              </span>
            </div>
          )}
          {msg && (
            <p className={`notice ${msg.ok ? "ok" : "err"}`} role={msg.ok ? "status" : "alert"} style={{ marginTop: 12 }}>
              {msg.text}
            </p>
          )}
        </div>
      </div>

      <div className="row" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "8px 0" }}>
        <h3 style={{ margin: 0 }}>Script ({script.scenes.length} scenes)</h3>
        {!draft && <span className="badge">Approved. Saving edits makes a new draft.</span>}
        <div className="spacer" />
        {dirty && <span className="small muted">Unsaved changes</span>}
        <button className="btn" type="button" disabled={!dirty || busy} onClick={() => { setScript(initial); setDirty(false); }}>
          Undo changes
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={!dirty || busy}
          onClick={() =>
            start(async () => {
              const r = await saveScript(explainerId, script);
              setMsg({ ok: r.ok, text: r.message ?? "" });
              if (r.ok) {
                setDirty(false);
                router.refresh();
              }
            })
          }
        >
          {busy ? "Saving…" : "Save & re-check numbers"}
        </button>
      </div>

      {script.scenes.map((sc, i) => (
        <section key={i} className="card" aria-labelledby={`scene-${i}`} style={flagged.has(`Scene ${i + 1}`) ? { borderColor: "#e8b4b4" } : undefined}>
          <h4 id={`scene-${i}`} style={{ margin: "0 0 10px" }}>
            Scene {i + 1}: {label(sc.visual)} {flagged.has(`Scene ${i + 1}`) && <span className="badge pending">has flagged numbers</span>}
          </h4>
          <div className="grid g2" style={{ gap: "0 14px" }}>
            <VisualFields v={sc.visual} set={(v) => setScene(i, { ...sc, visual: v })} />
          </div>
          <div style={{ marginTop: 8 }}>
            {sc.lines.map((ln, j) => (
              <div key={j} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 8, marginBottom: 8 }}>
                <select
                  aria-label={`Scene ${i + 1} line ${j + 1} speaker`}
                  className="inp"
                  value={ln.who}
                  onChange={(e) => setScene(i, { ...sc, lines: sc.lines.map((x, k) => (k === j ? { ...x, who: e.target.value as "penny" | "patch" } : x)) })}
                  style={{ width: 110 }}
                >
                  <option value="penny">Penny</option>
                  <option value="patch">Patch</option>
                </select>
                <textarea
                  aria-label={`Scene ${i + 1} line ${j + 1}`}
                  className="inp"
                  rows={2}
                  maxLength={199}
                  value={ln.text}
                  onChange={(e) => setScene(i, { ...sc, lines: sc.lines.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })}
                  style={{ flex: 1 }}
                />
                <span className="small muted" style={{ width: 52, textAlign: "right" }}>
                  {ln.text.length}/199
                </span>
                <button type="button" className="btn sm ghost danger" disabled={sc.lines.length <= 1} onClick={() => setScene(i, { ...sc, lines: sc.lines.filter((_, k) => k !== j) })} aria-label={`Remove scene ${i + 1} line ${j + 1}`}>
                  ✕
                </button>
              </div>
            ))}
            {sc.lines.length < 3 && (
              <button
                type="button"
                className="btn sm"
                onClick={() => setScene(i, { ...sc, lines: [...sc.lines, { who: sc.lines[sc.lines.length - 1]?.who === "penny" ? "patch" : "penny", text: "" }] })}
              >
                + Add line
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

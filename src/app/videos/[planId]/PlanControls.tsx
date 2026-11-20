"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "@/components/useFormAction";
import { Field, FormMessage } from "@/components/Field";
import { deletePlan, generateExplainer, renamePlan, replaceDocument, retryRender, type ActionResult } from "../actions";

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function GenerateButton({ planId, again }: { planId: string; again: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult>({ ok: false });
  const router = useRouter();
  const run = () => {
    if (again && !window.confirm("Write a brand-new script? Your current script stays in the history, but the editor will switch to the new one.")) return;
    start(async () => {
      const r = await generateExplainer(planId);
      setMsg(r);
      if (r.ok) router.refresh();
    });
  };
  return (
    <div className="grid" style={{ gap: 10 }}>
      <div>
        <button className={`btn ${again ? "" : "primary"}`} onClick={run} disabled={pending}>
          {pending ? "Claude is reading the document… (about a minute)" : again ? "Write a new script" : "Write the script with Claude"}
        </button>
      </div>
      <FormMessage state={msg} />
    </div>
  );
}

export function ReplaceForm({ planId }: { planId: string }) {
  const [state, onSubmit, pending] = useFormAction<ActionResult>(replaceDocument.bind(null, planId), { ok: false }, { resetOnOk: true });
  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 10, marginTop: 10 }}>
      <input name="file" type="file" accept="application/pdf,.pdf" required aria-label="New plan document (PDF)" />
      <FormMessage state={state} />
      <div>
        <button className="btn sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload PDF"}
        </button>
      </div>
    </form>
  );
}

export function RetryButton({ explainerId }: { explainerId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn sm" disabled={pending} onClick={() => start(async () => { await retryRender(explainerId); router.refresh(); })}>
      {pending ? "Starting…" : "Try rendering again"}
    </button>
  );
}

export function RenameForm({ planId, name, planYear }: { planId: string; name: string; planYear: string }) {
  const [state, onSubmit, pending] = useFormAction<ActionResult>(renamePlan.bind(null, planId), { ok: false });
  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Plan name" name="name" defaultValue={name} required inputProps={{ maxLength: 80 }} />
        <Field label="Plan year" name="planYear" defaultValue={planYear} inputProps={{ maxLength: 10 }} />
      </div>
      <FormMessage state={state} />
      <div>
        <button className="btn sm" disabled={pending}>
          Save
        </button>
      </div>
    </form>
  );
}

export function DeletePlan({ planId, name }: { planId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="row">
      <span className="small muted">Deletes the document, every script and every rendered video for this plan.</span>
      <button
        className="btn sm danger"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${name}" and all its videos? This can't be undone.`)) start(() => deletePlan(planId));
        }}
      >
        Delete plan
      </button>
    </div>
  );
}

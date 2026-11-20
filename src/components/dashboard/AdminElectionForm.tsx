"use client";
import { useState, useTransition } from "react";
import type { WaiveReason } from "@prisma/client";
import { RELATIONSHIPS, TIERS, WAIVE_REASONS, type Relationship } from "@/lib/domain/constants";
import { tierOf, type Dependent } from "@/lib/domain/tier";

type Start = {
  choice: string; // planId or "waive" or ""
  waiveReason: WaiveReason | "";
  waiveNote: string;
  dependents: Dependent[];
  tobacco: boolean;
  dob: string;
};

export function AdminElectionForm({
  plans,
  start,
  action,
}: {
  plans: { id: string; name: string }[];
  start: Start;
  action: (raw: unknown, note: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [d, setD] = useState(start);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startT] = useTransition();
  const set = <K extends keyof Start>(k: K, v: Start[K]) => setD((x) => ({ ...x, [k]: v }));
  const setDep = (i: number, p: Partial<Dependent>) => set("dependents", d.dependents.map((x, j) => (j === i ? { ...x, ...p } : x)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.choice) return setMsg({ ok: false, text: "Choose a plan or waive." });
    const choice =
      d.choice === "waive" ? { kind: "waive", reason: d.waiveReason, note: d.waiveNote } : { kind: "plan", planId: d.choice };
    startT(async () => {
      const r = await action(
        { dob: d.dob, phone: "", tobacco: d.tobacco, dependents: d.choice === "waive" ? [] : d.dependents, choice },
        note,
      );
      setMsg(r.ok ? { ok: true, text: "Saved as a new election version." } : { ok: false, text: r.error ?? "Couldn't save." });
      if (r.ok) setNote("");
    });
  }

  return (
    <form onSubmit={submit} className="card">
      <h3>Enter or change this election</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Admins can do this at any time, even outside the enrollment window. It&apos;s saved as a new version (older versions are kept) and
        recorded in the audit log with your name.
      </p>
      <div className="grid g3" style={{ gap: "0 14px" }}>
        <label className="f">
          Election
          <select value={d.choice} onChange={(e) => set("choice", e.target.value)}>
            <option value="">Select…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                Enroll: {p.name}
              </option>
            ))}
            <option value="waive">Waive coverage</option>
          </select>
        </label>
        {d.choice === "waive" ? (
          <>
            <label className="f">
              Waiver reason
              <select value={d.waiveReason} onChange={(e) => set("waiveReason", e.target.value as WaiveReason)}>
                <option value="">Select…</option>
                {Object.entries(WAIVE_REASONS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Waiver details {d.waiveReason === "OTHER" ? "" : "(optional)"}
              <input value={d.waiveNote} onChange={(e) => set("waiveNote", e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="f">
              Tobacco use
              <select value={d.tobacco ? "yes" : "no"} onChange={(e) => set("tobacco", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="f">
              Employee date of birth (optional)
              <input type="date" value={d.dob} onChange={(e) => set("dob", e.target.value)} />
            </label>
          </>
        )}
      </div>
      {d.choice && d.choice !== "waive" && (
        <>
          <h4 style={{ margin: "6px 0" }}>Family members · {TIERS[tierOf(d.dependents)]}</h4>
          {d.dependents.map((x, i) => (
            <fieldset key={i} className="dep">
              <legend className="sr-only">Family member {i + 1}</legend>
              <div className="grid g4" style={{ gap: "0 12px" }}>
                <label className="f">
                  Full name
                  <input value={x.name} onChange={(e) => setDep(i, { name: e.target.value })} />
                </label>
                <label className="f">
                  Relationship
                  <select value={x.relationship} onChange={(e) => setDep(i, { relationship: e.target.value as Relationship })}>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="f">
                  Date of birth
                  <input type="date" value={x.dob} onChange={(e) => setDep(i, { dob: e.target.value })} />
                </label>
                <div style={{ alignSelf: "end", marginBottom: 10 }}>
                  <button className="btn sm danger" type="button" onClick={() => set("dependents", d.dependents.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            </fieldset>
          ))}
          <button
            className="btn sm"
            type="button"
            onClick={() => set("dependents", [...d.dependents, { name: "", relationship: "Child", dob: "" }])}
          >
            + Add a family member
          </button>
        </>
      )}
      <label className="f" style={{ marginTop: 14 }}>
        Reason for this admin entry (required)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paper form received 11/20; qualifying life event: birth" required />
      </label>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save election"}
        </button>
        {msg && (
          <span className={`notice ${msg.ok ? "ok" : "err"}`} role={msg.ok ? "status" : "alert"} style={{ padding: "6px 10px" }}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

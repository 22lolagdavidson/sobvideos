"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tier, WaiveReason } from "@prisma/client";
import { PAY_PERIODS, PLAN_TYPES, RELATIONSHIPS, TIERS, WAIVE_REASONS, type Relationship } from "@/lib/domain/constants";
import { tierOf, validateDependents, type Dependent } from "@/lib/domain/tier";
import { money, type CostBreakdown } from "@/lib/domain/cost";
import { signatureMatches } from "@/lib/validation/election";
import { submitMyElection } from "@/app/enroll/actions";
import { MiniHosts } from "@/components/characters/Characters";

export type WizardPlan = {
  id: string;
  name: string;
  carrier: string;
  type: keyof typeof PLAN_TYPES;
  facts: [string, string][];
  cost: Record<Tier, CostBreakdown>;
  hasExplainer: boolean;
};
type Choice = { kind: "plan"; planId: string } | { kind: "waive"; reason: WaiveReason | ""; note: string } | null;
export type WizardStart = { dob: string; phone: string; tobacco: boolean; dependents: Dependent[]; choice: Choice };

const STEPS = ["Welcome", "About you", "Family", "Choose a plan", "Review & sign"];

type Props = {
  employee: { name: string; email: string; hireDate: string | null; eligible: boolean };
  group: {
    name: string;
    planYear: number;
    effectiveDate: string;
    windowStart: string;
    windowEnd: string;
    payPeriods: number;
    windowOpen: boolean;
    windowLabel: string;
  };
  plans: WizardPlan[];
  start: WizardStart;
  changing: boolean;
};

export function EnrollWizard({ employee, group, plans, start, changing }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(changing ? 1 : 0);
  const [d, setD] = useState({ ...start, attest: false, signature: "" });
  const [err, setErr] = useState("");
  const [saving, startSave] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the step heading on every step change (screen readers announce the new step).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const tier = tierOf(d.dependents);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }));
  const setDep = (i: number, patch: Partial<Dependent>) =>
    set("dependents", d.dependents.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const today = new Date().toISOString().slice(0, 10);

  function validate(s: number): string {
    if (s === 1) {
      if (!d.dob || d.dob > today) return "Please enter your date of birth.";
    }
    if (s === 2) {
      for (const x of d.dependents) if (!x.name.trim() || !x.dob || x.dob > today) return "Each family member needs a name and a date of birth.";
      const e = validateDependents(d.dependents);
      if (e) return e;
    }
    if (s === 3) {
      if (!d.choice) return "Choose a plan or waive coverage.";
      if (d.choice.kind === "waive" && !d.choice.reason) return "Please choose a reason for waiving.";
      if (d.choice.kind === "waive" && d.choice.reason === "OTHER" && !d.choice.note.trim()) return "Tell us a little about your other coverage.";
    }
    if (s === 4) {
      if (!d.attest) return "Please check the confirmation box.";
      if (!signatureMatches(d.signature, employee.name)) return `Type your name exactly as "${employee.name}" to sign.`;
    }
    return "";
  }

  function next() {
    const e = validate(step);
    setErr(e);
    if (e) return;
    if (step < 4) return setStep(step + 1);
    startSave(async () => {
      const r = await submitMyElection({
        dob: d.dob,
        phone: d.phone,
        tobacco: d.tobacco,
        dependents: d.choice?.kind === "plan" ? d.dependents : [],
        choice: d.choice,
        attest: d.attest,
        signatureName: d.signature,
      });
      if (!r.ok) return setErr(r.error);
      router.push("/enroll?submitted=1");
      router.refresh();
    });
  }
  const back = () => {
    setErr("");
    setStep(Math.max(changing ? 1 : 0, step - 1));
  };

  if (!group.windowOpen || !employee.eligible) {
    return (
      <div className="card hero">
        <div>
          <span className="badge">{group.planYear} open enrollment</span>
          <h1 style={{ marginTop: 8 }}>Hi, {employee.name.split(" ")[0]}!</h1>
          <div className="notice warn">
            {!employee.eligible
              ? "You aren't listed as eligible for benefits. If that's wrong, contact your HR team."
              : `Enrollment is ${group.windowLabel.startsWith("Closed") ? "closed" : "not open yet"}. ${group.windowLabel}.`}
          </div>
          <p>
            <Link href="/plans">Browse the plans and watch the explainers</Link>
          </p>
        </div>
        <MiniHosts />
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="card hero">
        <div>
          <span className="badge">{group.planYear} open enrollment</span>
          <h1 style={{ marginTop: 8 }}>Hi {employee.name.split(" ")[0]}! Let&apos;s pick your health coverage.</h1>
          <p className="muted">
            {group.name} offers {plans.length} plan{plans.length === 1 ? "" : "s"}, with coverage starting {group.effectiveDate}. It takes about
            5 minutes. You can also choose to waive coverage.
          </p>
          <p className="small muted">
            Enrollment window: {group.windowStart} to {group.windowEnd}
          </p>
          <div className="row">
            <button className="btn primary" type="button" onClick={() => setStep(1)}>
              Start enrollment →
            </button>
            <Link className="btn ghost" href="/plans">
              Watch the plan explainers first
            </Link>
          </div>
        </div>
        <MiniHosts />
      </div>
    );
  }

  const choicePlan = d.choice?.kind === "plan" ? plans.find((p) => p.id === (d.choice as { planId: string }).planId) : undefined;
  const k = choicePlan?.cost[tier];

  return (
    <div className="card">
      <ol className="steps" aria-label="Enrollment steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : undefined}>
            {i + 1}. {s}
            {i < step && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
      {changing && step === 1 && (
        <div className="notice" style={{ marginBottom: 12 }}>
          You&apos;re changing your election. Your new choice replaces the old one when you sign.
        </div>
      )}
      <div aria-live="assertive">
        {err && (
          <div className="notice err" role="alert" style={{ marginBottom: 12 }}>
            {err}
          </div>
        )}
      </div>

      {step === 1 && (
        <section>
          <h2 ref={headingRef} tabIndex={-1}>
            About you
          </h2>
          <div className="grid g2" style={{ gap: "0 16px" }}>
            <div className="f-wrap">
              <div className="small muted" style={{ fontWeight: 600 }}>
                Name on file
              </div>
              <div style={{ fontWeight: 600 }}>{employee.name}</div>
            </div>
            <div className="f-wrap">
              <div className="small muted" style={{ fontWeight: 600 }}>
                Work email
              </div>
              <div>{employee.email}</div>
            </div>
            <label className="f">
              Date of birth
              <input type="date" value={d.dob} max={today} onChange={(e) => set("dob", e.target.value)} required />
            </label>
            <label className="f">
              Phone (optional)
              <input type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
            </label>
            <label className="f">
              Used tobacco 4 or more times a week in the last 6 months?
              <select value={d.tobacco ? "yes" : "no"} onChange={(e) => set("tobacco", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>
          <p className="small muted">If your name or email is wrong, ask your HR team to fix it on the roster.</p>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 ref={headingRef} tabIndex={-1}>
            Who else needs coverage?
          </h2>
          <p className="muted small">Add a spouse, domestic partner or children. Leave this empty for employee-only coverage.</p>
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
                  <input type="date" value={x.dob} max={today} onChange={(e) => setDep(i, { dob: e.target.value })} />
                </label>
                <div style={{ alignSelf: "end", marginBottom: 10 }}>
                  <button
                    className="btn sm danger"
                    type="button"
                    onClick={() => set("dependents", d.dependents.filter((_, j) => j !== i))}
                    aria-label={`Remove ${x.name || `family member ${i + 1}`}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </fieldset>
          ))}
          <button
            className="btn"
            type="button"
            onClick={() =>
              set("dependents", [
                ...d.dependents,
                { name: "", relationship: d.dependents.some((x) => x.relationship !== "Child") ? "Child" : "Spouse", dob: "" },
              ])
            }
          >
            + Add a family member
          </button>
          <div className="notice" style={{ marginTop: 14 }} aria-live="polite">
            Coverage level: <b>{TIERS[tier]}</b>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 ref={headingRef} tabIndex={-1}>
            Choose a plan
          </h2>
          <p className="muted small">
            Prices shown for <b>{TIERS[tier]}</b>, per paycheck ({PAY_PERIODS[group.payPeriods as keyof typeof PAY_PERIODS]}). Not sure? Watch a
            plan&apos;s explainer video.
          </p>
          <div className="grid g3" role="radiogroup" aria-label="Plans">
            {plans.map((p) => {
              const c = p.cost[tier];
              const sel = d.choice?.kind === "plan" && d.choice.planId === p.id;
              return (
                <div key={p.id} className={`plan ${sel ? "sel" : ""}`}>
                  <div className="row">
                    <span className="badge">{PLAN_TYPES[p.type]}</span>
                    <span className="small muted">{p.carrier}</span>
                  </div>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <div>
                    <span className="price">{money(c.perPaycheck)}</span> <span className="small muted">/ paycheck</span>
                  </div>
                  <div className="small muted">
                    {money(c.employee)}/mo for you · {group.name} pays {money(c.employer)}/mo
                  </div>
                  {p.facts.length > 0 && (
                    <dl>
                      {p.facts.map(([l, v]) => (
                        <div key={l} style={{ display: "contents" }}>
                          <dt>{l}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {p.hasExplainer && (
                    <Link className="watch" href={`/plans/${p.id}/watch`} target="_blank">
                      <span className="tri" aria-hidden="true" /> Watch the explainer
                      <span className="sr-only"> (opens in a new tab)</span>
                    </Link>
                  )}
                  <button
                    className={`btn ${sel ? "primary" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => set("choice", { kind: "plan", planId: p.id })}
                  >
                    {sel ? "✓ Selected" : "Choose this plan"}
                  </button>
                </div>
              );
            })}
            <div className={`plan ${d.choice?.kind === "waive" ? "sel" : ""}`}>
              <h3 style={{ margin: 0 }}>Waive coverage</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Choose this if you don&apos;t want coverage through {group.name} this year.
              </p>
              <button
                className={`btn ${d.choice?.kind === "waive" ? "primary" : ""}`}
                type="button"
                role="radio"
                aria-checked={d.choice?.kind === "waive"}
                onClick={() => d.choice?.kind !== "waive" && set("choice", { kind: "waive", reason: "", note: "" })}
              >
                {d.choice?.kind === "waive" ? "✓ Waiving" : "Waive coverage"}
              </button>
              {d.choice?.kind === "waive" && (
                <>
                  <label className="f">
                    Reason
                    <select
                      value={d.choice.reason}
                      onChange={(e) => set("choice", { ...(d.choice as { kind: "waive"; note: string }), kind: "waive", reason: e.target.value as WaiveReason })}
                    >
                      <option value="">Select…</option>
                      {Object.entries(WAIVE_REASONS).map(([k2, l]) => (
                        <option key={k2} value={k2}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  {d.choice.reason === "OTHER" && (
                    <label className="f">
                      Tell us more
                      <input
                        value={d.choice.note}
                        onChange={(e) => set("choice", { ...(d.choice as { kind: "waive"; reason: WaiveReason }), kind: "waive", note: e.target.value })}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </div>
          {d.choice?.kind === "waive" && d.dependents.length > 0 && (
            <p className="small muted">Your family members won&apos;t be covered either if you waive.</p>
          )}
        </section>
      )}

      {step === 4 && (
        <section>
          <h2 ref={headingRef} tabIndex={-1}>
            Review &amp; sign
          </h2>
          <div className="grid g2">
            <div className="card">
              <div className="small muted">Employee</div>
              <b>{employee.name}</b>
              <div className="small">{employee.email}</div>
              <div className="small muted" style={{ marginTop: 10 }}>
                Family members
              </div>
              {d.choice?.kind === "plan" && d.dependents.length ? (
                d.dependents.map((x, i) => (
                  <div key={i} className="small">
                    {x.name} · {x.relationship}
                  </div>
                ))
              ) : (
                <div className="small">None</div>
              )}
            </div>
            <div className="card">
              <div className="small muted">Election</div>
              {d.choice?.kind === "waive" ? (
                <>
                  <b>Waiving coverage</b>
                  <div className="small">
                    {d.choice.reason && WAIVE_REASONS[d.choice.reason]}
                    {d.choice.note ? `: ${d.choice.note}` : ""}
                  </div>
                </>
              ) : (
                <>
                  <b>{choicePlan?.name}</b>
                  <div className="small">{TIERS[tier]}</div>
                  <div style={{ marginTop: 10 }}>
                    <span className="price">{money(k?.perPaycheck ?? 0)}</span> <span className="small muted">per paycheck</span>
                  </div>
                  <div className="small muted">
                    {money(k?.employee ?? 0)}/mo for you · employer pays {money(k?.employer ?? 0)}/mo
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <label className="row small" style={{ alignItems: "flex-start", gap: 10, flexWrap: "nowrap" }}>
              <input type="checkbox" checked={d.attest} onChange={(e) => set("attest", e.target.checked)} style={{ marginTop: 4 }} />
              <span>
                I confirm the information above is true and complete.{" "}
                {d.choice?.kind === "waive"
                  ? "I understand that by waiving, I may not be able to enroll until the next open enrollment unless I have a qualifying life event."
                  : "I authorize my employer to deduct my share of the premium from my pay."}
              </span>
            </label>
            <label className="f" style={{ marginTop: 12 }}>
              Type your full name to sign ({employee.name})
              <input value={d.signature} onChange={(e) => set("signature", e.target.value)} autoComplete="off" />
            </label>
          </div>
        </section>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        {step > (changing ? 1 : 0) && (
          <button className="btn" type="button" onClick={back} disabled={saving}>
            ← Back
          </button>
        )}
        {changing && (
          <Link className="btn ghost" href="/enroll">
            Cancel changes
          </Link>
        )}
        <div className="spacer" />
        <button className="btn primary" type="button" onClick={next} disabled={saving}>
          {step === 4 ? (saving ? "Saving…" : "Submit election ✓") : step === 3 ? "Review →" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useFormAction } from "@/components/useFormAction";
import { useTransition, useState } from "react";
import { Field, FormMessage } from "@/components/Field";
import { PLAN_TYPES, TIERS } from "@/lib/domain/constants";
import type { FormState } from "@/lib/validation/forms";

export type PlanValues = {
  id: string;
  name: string;
  carrier: string;
  type: string;
  deductible: string;
  deductibleFam: string;
  oop: string;
  oopFam: string;
  coinsurance: string;
  pcp: string;
  specialist: string;
  urgent: string;
  er: string;
  rx: string;
  rateEe: string;
  rateEs: string;
  rateEc: string;
  rateFam: string;
  electionCount: number;
  explainerStatus: string | null;
};

const BENEFITS: [keyof PlanValues, string, string][] = [
  ["deductible", "Deductible (individual)", "$1,500"],
  ["deductibleFam", "Deductible (family)", "$3,000"],
  ["oop", "Out-of-pocket max (individual)", "$6,000"],
  ["oopFam", "Out-of-pocket max (family)", "$12,000"],
  ["coinsurance", "Coinsurance", "20% after deductible"],
  ["pcp", "Primary care visit", "$25 copay"],
  ["specialist", "Specialist visit", "$50 copay"],
  ["urgent", "Urgent care", "$50 copay"],
  ["er", "Emergency room", "$250 copay"],
  ["rx", "Generic drugs", "$10 copay"],
];
const RATES: [keyof PlanValues, keyof typeof TIERS][] = [
  ["rateEe", "ee"],
  ["rateEs", "es"],
  ["rateEc", "ec"],
  ["rateFam", "fam"],
];

export function PlanEditor({
  plan,
  canEdit,
  save,
  remove,
}: {
  plan: PlanValues;
  canEdit: boolean;
  save: (s: FormState, fd: FormData) => Promise<FormState>;
  remove: () => Promise<FormState>;
}) {
  const [state, formAction, pending] = useFormAction(save, {});
  const [delMsg, setDelMsg] = useState<FormState>({});
  const [deleting, start] = useTransition();
  const e = state.fieldErrors ?? {};
  const v = (k: keyof PlanValues) => String(state.values?.[k] ?? plan[k] ?? "");
  const headingId = `plan-${plan.id}`;

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="row" style={{ marginBottom: 6 }}>
        <h3 id={headingId} style={{ margin: 0 }}>
          {plan.name}
        </h3>
        {plan.explainerStatus && <span className="badge">Explainer: {plan.explainerStatus.toLowerCase()}</span>}
        {plan.electionCount > 0 && <span className="badge enrolled">{plan.electionCount} elections</span>}
      </div>
      <form onSubmit={formAction} noValidate>
        <fieldset disabled={!canEdit}>
          <div className="grid g3" style={{ gap: "0 14px" }}>
            <Field label="Plan name" name="name" defaultValue={v("name")} error={e.name} required />
            <Field label="Carrier" name="carrier" defaultValue={v("carrier")} error={e.carrier} />
            <Field label="Plan type" name="type" defaultValue={v("type")} error={e.type}>
              {Object.entries(PLAN_TYPES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Field>
          </div>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600, margin: "4px 0 10px" }}>
              Benefits (in-network){" "}
              <span className="small muted" style={{ fontWeight: 400 }}>
                Filled in automatically from the SBC in step 4. You can edit them here.
              </span>
            </summary>
            <div className="grid g3" style={{ gap: "0 14px" }}>
              {BENEFITS.map(([k, label, ph]) => (
                <Field key={k} label={label} name={k} defaultValue={v(k)} error={e[k]} inputProps={{ placeholder: ph }} />
              ))}
            </div>
          </details>
          <h4 style={{ margin: "10px 0 6px" }}>Monthly premium rates</h4>
          <div className="grid g4" style={{ gap: "0 14px" }}>
            {RATES.map(([k, tier]) => (
              <Field
                key={k}
                label={`${TIERS[tier]} ($/month)`}
                name={k}
                type="number"
                inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
                defaultValue={v(k)}
                error={e[k]}
              />
            ))}
          </div>
        </fieldset>
        {canEdit && (
          <div className="row">
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save plan"}
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!window.confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
                start(async () => setDelMsg(await remove()));
              }}
            >
              Delete plan
            </button>
            <FormMessage state={state} />
            <FormMessage state={delMsg} />
          </div>
        )}
      </form>
    </section>
  );
}

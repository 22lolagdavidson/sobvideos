"use client";

import { useFormAction } from "@/components/useFormAction";
import { Field, FormMessage } from "@/components/Field";
import { PAY_PERIODS } from "@/lib/domain/constants";
import type { FormState } from "@/lib/validation/forms";

export type GroupValues = {
  name: string;
  planYear: number;
  effectiveDate: string;
  windowStart: string;
  windowEnd: string;
  payPeriods: number;
  eePct: number;
  depPct: number;
  participationTarget: number;
};

export function GroupForm({
  action,
  values,
  canEdit,
  submitLabel,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  values: GroupValues;
  canEdit: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useFormAction(action, {});
  const e = state.fieldErrors ?? {};
  const v = (k: keyof GroupValues) => state.values?.[k] ?? values[k];
  return (
    <form onSubmit={formAction} className="card" noValidate>
      <fieldset disabled={!canEdit}>
        <div className="grid g2" style={{ gap: "0 16px" }}>
          <Field label="Company name" name="name" defaultValue={v("name")} error={e.name} required />
          <Field label="Plan year" name="planYear" type="number" defaultValue={v("planYear")} error={e.planYear} required />
          <Field label="Coverage effective date" name="effectiveDate" type="date" defaultValue={v("effectiveDate")} error={e.effectiveDate} required />
          <Field label="Pay schedule" name="payPeriods" defaultValue={v("payPeriods")} error={e.payPeriods}>
            {Object.entries(PAY_PERIODS).map(([n, l]) => (
              <option key={n} value={n}>
                {l} ({n} paychecks a year)
              </option>
            ))}
          </Field>
          <Field label="Enrollment opens" name="windowStart" type="date" defaultValue={v("windowStart")} error={e.windowStart} required />
          <Field
            label="Enrollment closes"
            name="windowEnd"
            type="date"
            defaultValue={v("windowEnd")}
            error={e.windowEnd}
            hint="Employees can enroll or make changes through the end of this day."
            required
          />
        </div>
        <h3 style={{ marginTop: 8 }}>Employer contribution</h3>
        <div className="grid g3" style={{ gap: "0 16px" }}>
          <Field
            label="% of the employee-only rate"
            name="eePct"
            type="number"
            inputProps={{ min: 0, max: 100, step: "0.01" }}
            defaultValue={v("eePct")}
            error={e.eePct}
          />
          <Field
            label="% of the extra cost for dependents"
            name="depPct"
            type="number"
            inputProps={{ min: 0, max: 100, step: "0.01" }}
            defaultValue={v("depPct")}
            error={e.depPct}
          />
          <Field
            label="Participation target %"
            name="participationTarget"
            type="number"
            inputProps={{ min: 0, max: 100, step: "0.01" }}
            defaultValue={v("participationTarget")}
            error={e.participationTarget}
            hint="Participation rules vary by carrier."
          />
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          The employer pays the first % of the plan&apos;s employee-only rate, plus the second % of whatever a bigger tier
          costs on top of that. It never pays more than the full premium.
        </p>
      </fieldset>
      {canEdit ? (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          <FormMessage state={state} />
        </div>
      ) : (
        <p className="small muted">Only your broker can change these settings.</p>
      )}
    </form>
  );
}

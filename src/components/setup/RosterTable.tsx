"use client";
import { useFormAction } from "@/components/useFormAction";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/Field";
import type { FormState } from "@/lib/validation/forms";

export type RosterEmployee = {
  id: string;
  name: string;
  email: string;
  hireDate: string; // YYYY-MM-DD or ""
  eligible: boolean;
  status: "ENROLLED" | "WAIVED" | null;
  signedIn: boolean;
};

type SaveFn = (employeeId: string | null, s: FormState, fd: FormData) => Promise<FormState>;
type RemoveFn = (employeeId: string) => Promise<FormState>;

function EmployeeForm({
  emp,
  save,
  onDone,
  submitLabel,
}: {
  emp: RosterEmployee | null;
  save: SaveFn;
  onDone?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending, ref] = useFormAction(async (s: FormState, fd: FormData) => {
    const r = await save(emp?.id ?? null, s, fd);
    if (r.ok && onDone) onDone();
    return r;
  }, {}, { resetOnOk: !emp });
  const e = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form ref={ref} onSubmit={formAction} noValidate>
      <div className="grid g4" style={{ gap: "0 12px", alignItems: "start" }}>
        <Field label="Full name" name="name" defaultValue={v?.name ?? emp?.name ?? ""} error={e.name} required />
        <Field label="Email" name="email" type="email" defaultValue={v?.email ?? emp?.email ?? ""} error={e.email} required />
        <Field label="Hire date" name="hireDate" type="date" defaultValue={v?.hireDate ?? emp?.hireDate ?? ""} error={e.hireDate} />
        <label className="row small" style={{ marginTop: 26, fontWeight: 600 }}>
          <input type="checkbox" name="eligible" defaultChecked={v ? v.eligible === "on" : (emp?.eligible ?? true)} /> Eligible
          for benefits
        </label>
      </div>
      <div className="row">
        <button className="btn primary sm" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onDone && emp && (
          <button className="btn sm" type="button" onClick={onDone}>
            Cancel
          </button>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RosterTable({ employees, save, remove }: { employees: RosterEmployee[]; save: SaveFn; remove: RemoveFn }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<FormState>({});
  const [busy, start] = useTransition();

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Roster ({employees.length})</h3>
        <div className="spacer" />
        <button className="btn sm" type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          {adding ? "Close" : "+ Add one employee"}
        </button>
      </div>
      {adding && (
        <div className="notice" style={{ marginBottom: 12, background: "#f7f9ff" }}>
          <EmployeeForm emp={null} save={save} submitLabel="Add employee" />
        </div>
      )}
      <FormMessage state={msg} />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Hire date</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No employees yet. Import a roster above.
                </td>
              </tr>
            )}
            {employees.map((emp) =>
              editing === emp.id ? (
                <tr key={emp.id}>
                  <td colSpan={5}>
                    <EmployeeForm emp={emp} save={save} onDone={() => setEditing(null)} submitLabel="Save" />
                  </td>
                </tr>
              ) : (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.hireDate || "—"}</td>
                  <td>
                    {!emp.eligible ? (
                      <span className="badge">Not eligible</span>
                    ) : emp.status ? (
                      <span className={`badge ${emp.status.toLowerCase()}`}>{emp.status === "ENROLLED" ? "Enrolled" : "Waived"}</span>
                    ) : (
                      <span className="badge pending">Pending</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn sm ghost" type="button" onClick={() => setEditing(emp.id)} aria-label={`Edit ${emp.name}`}>
                      Edit
                    </button>
                    <button
                      className="btn sm ghost danger"
                      type="button"
                      disabled={busy}
                      aria-label={`Remove ${emp.name}`}
                      onClick={() => {
                        if (!window.confirm(`Remove ${emp.name} from the roster?`)) return;
                        start(async () => setMsg(await remove(emp.id)));
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

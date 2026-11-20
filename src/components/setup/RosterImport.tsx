"use client";

import { useFormAction } from "@/components/useFormAction";
import { FormMessage } from "@/components/Field";
import type { ImportState } from "@/app/groups/[groupId]/setup/actions";

export function RosterImport({ action }: { action: (s: ImportState, fd: FormData) => Promise<ImportState> }) {
  const [state, formAction, pending, ref] = useFormAction(action, {}, { resetOnOk: true });
  return (
    <form ref={ref} onSubmit={formAction} className="card">
      <h3>Import employees</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Paste rows from a spreadsheet or upload a CSV with <b>name, email, hire date</b>. A header row is optional. New
        emails are added and existing ones are updated. Nobody is removed.
      </p>
      <label className="f">
        Paste rows
        <textarea
          name="text"
          placeholder={"Alex Rivera, alex@company.com, 03/15/2021\nJordan Lee, jordan@company.com, 2019-08-01"}
          rows={5}
        />
      </label>
      <label className="f">
        Or upload a CSV file
        <input type="file" name="file" accept=".csv,.txt,.tsv,text/csv,text/plain" />
      </label>
      <div className="row">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </button>
        <FormMessage state={state} />
      </div>
      {!!state.errors?.length && (
        <div className="notice warn" style={{ marginTop: 12 }}>
          <b>These rows were skipped:</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {state.errors.slice(0, 20).map((er) => (
              <li key={er.line}>
                Line {er.line}: {er.error} <span className="muted">({er.text})</span>
              </li>
            ))}
          </ul>
          {state.errors.length > 20 && <div>…and {state.errors.length - 20} more.</div>}
        </div>
      )}
    </form>
  );
}

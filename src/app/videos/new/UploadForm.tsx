"use client";
import { useFormAction } from "@/components/useFormAction";
import { Field, FormMessage } from "@/components/Field";
import { createFromUpload, type ActionResult } from "../actions";

export function UploadForm() {
  const [state, onSubmit, pending] = useFormAction<ActionResult>(createFromUpload, { ok: false });
  const year = new Date().getFullYear() + 1;
  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <div className="dropzone">
        <label htmlFor="file" style={{ fontWeight: 700 }}>
          Plan document (PDF, up to 10 MB)
        </label>
        <div>
          <input id="file" name="file" type="file" accept="application/pdf,.pdf" required />
        </div>
      </div>
      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Plan name (optional)" name="name" hint="Leave blank to use the file name." inputProps={{ maxLength: 80, placeholder: "e.g. Gold PPO 1500" }} />
        <Field label="Plan year (optional)" name="planYear" inputProps={{ maxLength: 10, placeholder: String(year) }} />
      </div>
      <FormMessage state={state} />
      <div className="row">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Uploading and reading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

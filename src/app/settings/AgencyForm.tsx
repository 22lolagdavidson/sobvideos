"use client";
import { useFormAction } from "@/components/useFormAction";
import { Field, FormMessage } from "@/components/Field";
import { saveAgency } from "./actions";
import type { ActionResult } from "@/app/videos/actions";

type Props = { name: string; contactEmail: string; brandPrimary: string; logoUrl: string | null };

export function AgencyForm({ name, contactEmail, brandPrimary, logoUrl }: Props) {
  const [state, onSubmit, pending] = useFormAction<ActionResult>(saveAgency, { ok: false });
  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="Agency name" name="name" defaultValue={name} required inputProps={{ maxLength: 80 }} />
        <Field label="Contact email (optional)" name="contactEmail" type="email" defaultValue={contactEmail} />
      </div>
      <label className="f" style={{ maxWidth: 200 }}>
        Brand color
        <input type="color" name="brandPrimary" defaultValue={brandPrimary} style={{ height: 42, padding: 4 }} />
      </label>
      <div>
        <div className="small" style={{ fontWeight: 600, color: "var(--muted)" }}>
          Logo (PNG or JPG, up to 1 MB)
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Current logo" style={{ maxHeight: 64, maxWidth: 240, margin: "8px 0", display: "block" }} />
        )}
        <input type="file" name="logo" accept="image/png,image/jpeg" aria-label="Upload a logo" />
        {logoUrl && (
          <label className="small" style={{ display: "block", marginTop: 6 }}>
            <input type="checkbox" name="removeLogo" /> Remove the current logo
          </label>
        )}
      </div>
      <FormMessage state={state} />
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

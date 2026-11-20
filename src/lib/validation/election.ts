import { z } from "zod";
import { RELATIONSHIPS } from "@/lib/domain/constants";
import { validateDependents } from "@/lib/domain/tier";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date");
const today = () => new Date().toISOString().slice(0, 10);
const pastDate = (label: string) => isoDate.refine((d) => d <= today() && d >= "1900-01-01", `${label} must be a real date in the past`);

export const WAIVE_REASON_VALUES = [
  "SPOUSE_EMPLOYER_PLAN",
  "OTHER_EMPLOYER_PLAN",
  "MEDICARE",
  "MEDICAID_CHIP",
  "TRICARE_VA",
  "MARKETPLACE",
  "OTHER",
] as const;

export const DependentInput = z.object({
  name: z.string().trim().min(1, "Each family member needs a name").max(120),
  relationship: z.enum(RELATIONSHIPS),
  dob: pastDate("Each family member's date of birth"),
});

/** What the wizard (or an admin) submits. Costs are never accepted from the client. */
export const ElectionInput = z
  .object({
    dob: z.union([pastDate("Your date of birth"), z.literal("")]), // required for employees, optional for admin entry
    phone: z.string().trim().max(40).default(""),
    tobacco: z.boolean(),
    dependents: z.array(DependentInput).max(12),
    choice: z.union([z.object({ kind: z.literal("plan"), planId: z.string().min(1) }), z.object({ kind: z.literal("waive"), reason: z.enum(WAIVE_REASON_VALUES), note: z.string().trim().max(300).default("") })]),
    attest: z.literal(true, { error: "Please check the confirmation box." }),
    signatureName: z.string().trim().min(1, "Type your full name to sign").max(120),
  })
  .superRefine((v, ctx) => {
    const depErr = validateDependents(v.dependents);
    if (depErr) ctx.addIssue({ code: "custom", path: ["dependents"], message: depErr });
    if (v.choice.kind === "waive" && v.choice.reason === "OTHER" && !v.choice.note)
      ctx.addIssue({ code: "custom", path: ["choice"], message: "Tell us a little about your other coverage." });
  });
export type ElectionInput = z.infer<typeof ElectionInput>;

/** Signature must match the employee's name on file (case and extra spaces ignored). */
export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const signatureMatches = (typed: string, name: string) => normName(typed) === normName(name);

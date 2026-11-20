import { z } from "zod";
import { PAY_PERIOD_VALUES } from "@/lib/domain/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const pct = (label: string) =>
  z.coerce.number({ error: `${label} must be a number` }).min(0, `${label} can't be below 0`).max(100, `${label} can't be over 100`);
const money = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(100000, `${label} looks too large`);

/** YYYY-MM-DD -> Date at UTC midnight (how Prisma stores @db.Date). */
export const toDate = (s: string) => new Date(s + "T00:00:00Z");

export const GroupInput = z
  .object({
    name: z.string().trim().min(1, "Enter the company name").max(120),
    planYear: z.coerce.number().int().min(2000).max(2100),
    effectiveDate: isoDate,
    windowStart: isoDate,
    windowEnd: isoDate,
    payPeriods: z.coerce
      .number()
      .refine((n) => (PAY_PERIOD_VALUES as readonly number[]).includes(n), "Pick a pay schedule"),
    eePct: pct("Employee contribution"),
    depPct: pct("Dependent contribution"),
    participationTarget: pct("Participation target"),
  })
  .refine((g) => g.windowStart <= g.windowEnd, { path: ["windowEnd"], message: "The window must end on or after it starts" });
export type GroupInput = z.infer<typeof GroupInput>;

export const PLAN_TYPE_VALUES = ["PPO", "HMO", "EPO", "POS", "HDHP_HSA", "Other"] as const;
const benefit = z.string().trim().max(120).default("");

export const PlanInput = z.object({
  name: z.string().trim().min(1, "Enter a plan name").max(80),
  carrier: z.string().trim().max(80).default(""),
  type: z.enum(PLAN_TYPE_VALUES),
  deductible: benefit,
  deductibleFam: benefit,
  oop: benefit,
  oopFam: benefit,
  coinsurance: benefit,
  pcp: benefit,
  specialist: benefit,
  urgent: benefit,
  er: benefit,
  rx: benefit,
  rateEe: money("Employee-only rate"),
  rateEs: money("Employee + spouse rate"),
  rateEc: money("Employee + children rate"),
  rateFam: money("Family rate"),
});
export type PlanInput = z.infer<typeof PlanInput>;

export const EmployeeInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  hireDate: z.union([isoDate, z.literal("")]).default(""),
  eligible: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type EmployeeInput = z.infer<typeof EmployeeInput>;

export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back on a validation error so React 19's form reset doesn't wipe them. */
  values?: Record<string, string>;
};

/** Zod error -> { field: first message } for inline form errors. */
export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? "_");
    out[k] ??= i.message;
  }
  return out;
}

export const formObject = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));

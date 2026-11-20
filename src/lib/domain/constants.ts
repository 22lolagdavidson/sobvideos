import type { PlanType, Tier, WaiveReason } from "@prisma/client";

export const TIERS: Record<Tier, string> = {
  ee: "Employee only",
  es: "Employee + Spouse/Partner",
  ec: "Employee + Child(ren)",
  fam: "Family",
};

export const PAY_PERIODS = { 52: "Weekly", 26: "Every two weeks", 24: "Twice a month", 12: "Monthly" } as const;
export type PayPeriods = keyof typeof PAY_PERIODS;
export const PAY_PERIOD_VALUES = [52, 26, 24, 12] as const;

export const PLAN_TYPES: Record<PlanType, string> = {
  PPO: "PPO",
  HMO: "HMO",
  EPO: "EPO",
  POS: "POS",
  HDHP_HSA: "HDHP/HSA",
  Other: "Other",
};

/** Waiver reasons, in the order the wizard shows them. Wording matches the prototype. */
export const WAIVE_REASONS: Record<WaiveReason, string> = {
  SPOUSE_EMPLOYER_PLAN: "Covered by spouse/partner's employer plan",
  OTHER_EMPLOYER_PLAN: "Covered by another employer plan",
  MEDICARE: "Medicare",
  MEDICAID_CHIP: "Medicaid / CHIP",
  TRICARE_VA: "TRICARE / VA",
  MARKETPLACE: "Individual (Marketplace) plan",
  OTHER: "Other",
};

/** Waivers that count as "other coverage" and leave the participation denominator. */
export const OTHER_COVERAGE_REASONS: ReadonlySet<WaiveReason> = new Set<WaiveReason>([
  "SPOUSE_EMPLOYER_PLAN",
  "OTHER_EMPLOYER_PLAN",
  "MEDICARE",
  "MEDICAID_CHIP",
  "TRICARE_VA",
]);

export const RELATIONSHIPS = ["Spouse", "Domestic partner", "Child"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

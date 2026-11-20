import type { Tier } from "@prisma/client";

export type Rates = { ee: number; es: number; ec: number; fam: number };
export type Contribution = { eePct: number; depPct: number; payPeriods: number };
export type CostBreakdown = { premium: number; employer: number; employee: number; perPaycheck: number };

/**
 * P = plan rate for the tier, E = plan's employee-only rate.
 * employer = min(P, E × eePct/100 + max(0, P − E) × depPct/100)
 * employee = P − employer; perPaycheck = employee × 12 / payPeriods.
 * Values are NOT rounded here. Round to cents only when displaying (see money()).
 */
export function cost(rates: Rates, tier: Tier, c: Contribution): CostBreakdown {
  const P = Number(rates[tier]) || 0;
  const E = Number(rates.ee) || 0;
  const employer = Math.min(P, (E * c.eePct) / 100 + (Math.max(0, P - E) * c.depPct) / 100);
  const employee = P - employer;
  const perPaycheck = (employee * 12) / c.payPeriods;
  return { premium: P, employer, employee, perPaycheck };
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** Display helper: the only place amounts get rounded to cents. */
export const money = (n: number | string | { toString(): string }) => fmt.format(Number(n.toString()) || 0);

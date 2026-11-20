import type { WaiveReason } from "@prisma/client";
import { OTHER_COVERAGE_REASONS } from "./constants";

export type ParticipationInput = {
  eligible: number;
  enrolled: number;
  waivers: ReadonlyArray<WaiveReason | null>;
};

export type Participation = {
  eligible: number;
  enrolled: number;
  waived: number;
  waivedOtherCoverage: number;
  denominator: number;
  /** 0–100, or null when the denominator is 0. */
  pct: number | null;
};

/**
 * Participation = enrolled ÷ (eligible − waivers with other coverage).
 * Marketplace and Other waivers stay in the denominator. Rules vary by carrier.
 */
export function participation({ eligible, enrolled, waivers }: ParticipationInput): Participation {
  const waivedOtherCoverage = waivers.filter((r) => r != null && OTHER_COVERAGE_REASONS.has(r)).length;
  const denominator = eligible - waivedOtherCoverage;
  return {
    eligible,
    enrolled,
    waived: waivers.length,
    waivedOtherCoverage,
    denominator,
    pct: denominator > 0 ? (enrolled / denominator) * 100 : null,
  };
}

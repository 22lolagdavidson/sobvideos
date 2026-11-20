import type { Tier } from "@prisma/client";
import type { Relationship } from "./constants";

export type Dependent = { name: string; relationship: Relationship; dob: string };

const isPartner = (d: { relationship: string }) =>
  d.relationship === "Spouse" || d.relationship === "Domestic partner";

/**
 * Coverage tier from dependents: spouse/partner + at least one child = fam;
 * spouse/partner only = es; children only = ec; nobody = ee.
 */
export function tierOf(deps: ReadonlyArray<{ relationship: string }>): Tier {
  const sp = deps.some(isPartner);
  const ch = deps.some((d) => d.relationship === "Child");
  return sp && ch ? "fam" : sp ? "es" : ch ? "ec" : "ee";
}

/** At most one spouse or domestic partner. Returns an error message or null. */
export function validateDependents(deps: ReadonlyArray<{ relationship: string }>): string | null {
  if (deps.filter(isPartner).length > 1) return "You can add only one spouse or domestic partner.";
  return null;
}

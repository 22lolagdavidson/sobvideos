import { describe, expect, it } from "vitest";
import { tierOf, validateDependents } from "./tier";
import { cost } from "./cost";
import { participation } from "./participation";
import { windowState } from "./window";

const d = (relationship: string) => ({ relationship });

describe("tierOf", () => {
  it("maps dependents to a coverage tier", () => {
    expect(tierOf([])).toBe("ee");
    expect(tierOf([d("Spouse")])).toBe("es");
    expect(tierOf([d("Domestic partner")])).toBe("es");
    expect(tierOf([d("Child"), d("Child")])).toBe("ec");
    expect(tierOf([d("Spouse"), d("Child")])).toBe("fam");
    expect(tierOf([d("Domestic partner"), d("Child")])).toBe("fam");
  });
  it("allows at most one spouse or partner", () => {
    expect(validateDependents([d("Spouse"), d("Child")])).toBeNull();
    expect(validateDependents([d("Spouse"), d("Domestic partner")])).toMatch(/only one/);
  });
});

describe("cost", () => {
  const rates = { ee: 600, es: 1200, ec: 1000, fam: 1800 };
  it("employee-only: employer pays eePct of E", () => {
    const c = cost(rates, "ee", { eePct: 75, depPct: 25, payPeriods: 26 });
    expect(c.premium).toBe(600);
    expect(c.employer).toBe(450);
    expect(c.employee).toBe(150);
    expect(c.perPaycheck).toBeCloseTo((150 * 12) / 26, 10);
  });
  it("family: employer adds depPct of the dependent portion", () => {
    const c = cost(rates, "fam", { eePct: 75, depPct: 25, payPeriods: 24 });
    expect(c.employer).toBe(600 * 0.75 + 1200 * 0.25); // 750
    expect(c.employee).toBe(1050);
    expect(c.perPaycheck).toBe(525);
  });
  it("employer share never exceeds the premium", () => {
    const c = cost(rates, "es", { eePct: 100, depPct: 100, payPeriods: 12 });
    expect(c.employer).toBe(1200);
    expect(c.employee).toBe(0);
  });
  it("does not round", () => {
    const c = cost({ ee: 612.4, es: 0, ec: 0, fam: 0 }, "ee", { eePct: 33, depPct: 0, payPeriods: 52 });
    expect(c.employer).toBeCloseTo(202.092, 10);
  });
});

describe("participation", () => {
  it("removes other-coverage waivers from the denominator only", () => {
    const p = participation({
      eligible: 10,
      enrolled: 6,
      waivers: ["SPOUSE_EMPLOYER_PLAN", "MEDICARE", "MARKETPLACE", "OTHER"],
    });
    expect(p.denominator).toBe(8);
    expect(p.pct).toBe(75);
    expect(p.waivedOtherCoverage).toBe(2);
  });
  it("returns null when nobody is left in the denominator", () => {
    expect(participation({ eligible: 1, enrolled: 0, waivers: ["TRICARE_VA"] }).pct).toBeNull();
  });
});

describe("windowState", () => {
  const g = { windowStart: new Date("2026-11-01T00:00:00Z"), windowEnd: new Date("2026-11-30T00:00:00Z") };
  it("is inclusive of both ends", () => {
    expect(windowState(g, "2026-10-31").key).toBe("soon");
    expect(windowState(g, "2026-11-01").open).toBe(true);
    expect(windowState(g, "2026-11-30").open).toBe(true);
    expect(windowState(g, "2026-12-01").key).toBe("closed");
  });
});

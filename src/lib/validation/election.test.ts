import { describe, expect, it } from "vitest";
import { ElectionInput, signatureMatches } from "./election";

const base = {
  dob: "1990-01-01",
  phone: "",
  tobacco: false,
  dependents: [],
  choice: { kind: "plan", planId: "p1" },
  attest: true,
  signatureName: "Alex Rivera",
};

describe("e-signature", () => {
  it("ignores case and extra spaces, nothing else", () => {
    expect(signatureMatches("  alex   RIVERA ", "Alex Rivera")).toBe(true);
    expect(signatureMatches("Alex R.", "Alex Rivera")).toBe(false);
  });
});

describe("ElectionInput", () => {
  it("accepts a valid enrollment", () => {
    expect(ElectionInput.safeParse(base).success).toBe(true);
  });
  it("requires the attestation", () => {
    expect(ElectionInput.safeParse({ ...base, attest: false }).success).toBe(false);
  });
  it("rejects two spouses/partners", () => {
    const r = ElectionInput.safeParse({
      ...base,
      dependents: [
        { name: "A", relationship: "Spouse", dob: "1990-01-01" },
        { name: "B", relationship: "Domestic partner", dob: "1990-01-01" },
      ],
    });
    expect(r.success).toBe(false);
  });
  it("needs a note when the waiver reason is Other", () => {
    expect(ElectionInput.safeParse({ ...base, choice: { kind: "waive", reason: "OTHER", note: "" } }).success).toBe(false);
    expect(ElectionInput.safeParse({ ...base, choice: { kind: "waive", reason: "MEDICARE", note: "" } }).success).toBe(true);
  });
  it("rejects future birthdays", () => {
    expect(ElectionInput.safeParse({ ...base, dob: "2999-01-01" }).success).toBe(false);
  });
});

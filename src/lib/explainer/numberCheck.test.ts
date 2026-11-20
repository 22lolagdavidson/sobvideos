import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractNumbers, numberCheck } from "./numberCheck";
import { goldPpoScript } from "../../../prisma/seed-data/explainer-gold-ppo";

const sbc = readFileSync(path.join(__dirname, "../../../prisma/seed-data/sbc-gold-ppo.txt"), "utf8");

describe("extractNumbers", () => {
  it("normalizes dollars and percents", () => {
    expect(extractNumbers("Pay $1,500.00 or $25, then 20 % and 40 percent").map((n) => n.key)).toEqual([
      "$1500",
      "$25",
      "20%",
      "40%",
    ]);
  });
});

describe("numberCheck", () => {
  it("passes the seeded script against its SBC", () => {
    expect(numberCheck(goldPpoScript, sbc)).toEqual([]);
  });
  it("flags amounts that aren't in the SBC, with locations", () => {
    const bad = structuredClone(goldPpoScript);
    bad.scenes[2].lines[1].text = "A regular doctor visit is $30.";
    bad.scenes[3].visual = { kind: "split", title: "Coinsurance", you: 25, plan: 75 };
    const issues = numberCheck(bad, sbc);
    expect(issues.map((i) => i.key).sort()).toEqual(["$30", "25%", "75%"]);
    expect(issues.find((i) => i.key === "$30")?.where).toEqual(["Scene 3 · line 2"]);
  });
});

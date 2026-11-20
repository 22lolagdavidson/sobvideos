import { describe, expect, it } from "vitest";
import { normalizeScript } from "./normalize";
import { ExplainerScript } from "./schema";

const plan = { name: "P", carrier: "", type: "PPO", deductible: "", deductibleFam: "", oop: "", oopFam: "", coinsurance: "", pcp: "", specialist: "", urgent: "", er: "", rx: "" };
const line = (who: "penny" | "patch", text: string) => ({ who, text });

describe("normalizeScript", () => {
  it("fixes the coinsurance split, trims long text and drops empty scenes", () => {
    const raw = {
      plan,
      scenes: [
        { visual: { kind: "title", title: "P", subtitle: "x" }, lines: [line("penny", "Hi!"), line("patch", "a".repeat(400))] },
        { visual: { kind: "split", title: "Coinsurance", you: 20, plan: 70 }, lines: [line("penny", "What's that?")] },
        { visual: { kind: "meter", label: "Deductible", amount: "$1,500", note: "" }, lines: [] },
        { visual: { kind: "quiz", question: "Q?", options: ["a", "b", "c", "d"], answer: 1 }, lines: [line("patch", "Plan docs are official.")] },
      ],
    };
    const s = normalizeScript(raw as never);
    expect(ExplainerScript.safeParse(s).success).toBe(true);
    expect(s.scenes).toHaveLength(3);
    expect(s.scenes[0].lines[1].text.length).toBeLessThan(200);
    const split = s.scenes[1].visual;
    expect(split.kind === "split" && split.you + split.plan).toBe(100);
    const quiz = s.scenes[2].visual;
    expect(quiz.kind === "quiz" && quiz.options).toHaveLength(3);
  });
});

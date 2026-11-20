import { z } from "zod";

/**
 * The explainer script Claude writes from an SBC, and that the broker edits
 * on the review screen. The same shape drives the Remotion composition.
 */

const short = (max = 120) => z.string().max(max);

export const PLAN_TYPE_STRINGS = ["PPO", "HMO", "EPO", "POS", "HDHP/HSA", "Other"] as const;

export const ScriptPlan = z.object({
  name: short(),
  carrier: short(),
  type: z.enum(PLAN_TYPE_STRINGS).or(z.literal("")),
  deductible: short(),
  deductibleFam: short(),
  oop: short(),
  oopFam: short(),
  coinsurance: short(),
  pcp: short(),
  specialist: short(),
  urgent: short(),
  er: short(),
  rx: short(),
});
export type ScriptPlan = z.infer<typeof ScriptPlan>;

export const Line = z.object({
  who: z.enum(["penny", "patch"]),
  text: z.string().min(1).max(199),
});
export type Line = z.infer<typeof Line>;

const Amount = z.object({ label: short(60), amount: short(40) });

export const Visual = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title"), title: short(80), subtitle: short(160) }),
  z.object({ kind: z.literal("meter"), label: short(40), amount: short(40), note: short(160) }),
  z.object({ kind: z.literal("prices"), title: short(60), items: z.array(Amount).min(1).max(5) }),
  z.object({
    kind: z.literal("split"),
    title: short(60),
    you: z.number().min(0).max(100),
    plan: z.number().min(0).max(100),
  }),
  z.object({ kind: z.literal("shield"), label: short(40), amount: short(40), note: short(200) }),
  z.object({
    kind: z.literal("story"),
    title: short(80),
    rows: z.array(Amount).min(1).max(6),
    total: short(40),
  }),
  z.object({
    kind: z.literal("list"),
    tone: z.enum(["good", "bad", "recap"]),
    title: short(60),
    items: z.array(short(120)).min(1).max(6),
  }),
  z.object({
    kind: z.literal("quiz"),
    question: short(200),
    options: z.array(short(100)).length(3),
    answer: z.number().int().min(0).max(2),
  }),
]);
export type Visual = z.infer<typeof Visual>;
export type SceneKind = Visual["kind"];

export const Scene = z.object({
  visual: Visual,
  lines: z.array(Line).min(1).max(3),
});
export type Scene = z.infer<typeof Scene>;

export const ExplainerScript = z.object({
  plan: ScriptPlan,
  scenes: z.array(Scene).min(3).max(12),
});
export type ExplainerScript = z.infer<typeof ExplainerScript>;

/** Required scene order; generation may skip kinds the SBC can't support. */
export const SCENE_ORDER = [
  "title",
  "meter",
  "prices",
  "split",
  "shield",
  "story",
  "list:good",
  "list:bad",
  "list:recap",
  "quiz",
] as const;

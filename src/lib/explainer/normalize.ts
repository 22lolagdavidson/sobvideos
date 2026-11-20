import { z } from "zod";
import { ExplainerScript, PLAN_TYPE_STRINGS, type ExplainerScript as Script } from "./schema";

/*
 * Claude reads the plan document and returns the script as structured output.
 * Only the plan document leaves our servers: no employee or user data is sent.
 *
 * The schema sent to the API (LooseScript) has no length/count limits, because structured
 * outputs don't enforce those; we clamp and then validate with the strict ExplainerScript.
 */

const s = z.string();
const Amount = z.object({ label: s, amount: s });
const LooseVisual = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("title"), title: s, subtitle: s }),
  z.object({ kind: z.literal("meter"), label: s, amount: s, note: s }),
  z.object({ kind: z.literal("prices"), title: s, items: z.array(Amount) }),
  z.object({ kind: z.literal("split"), title: s, you: z.number(), plan: z.number() }),
  z.object({ kind: z.literal("shield"), label: s, amount: s, note: s }),
  z.object({ kind: z.literal("story"), title: s, rows: z.array(Amount), total: s }),
  z.object({ kind: z.literal("list"), tone: z.enum(["good", "bad", "recap"]), title: s, items: z.array(s) }),
  z.object({ kind: z.literal("quiz"), question: s, options: z.array(s), answer: z.number().int() }),
]);
export const LooseScript = z.object({
  plan: z.object({
    name: s,
    carrier: s,
    type: z.enum([...PLAN_TYPE_STRINGS, ""]),
    deductible: s,
    deductibleFam: s,
    oop: s,
    oopFam: s,
    coinsurance: s,
    pcp: s,
    specialist: s,
    urgent: s,
    er: s,
    rx: s,
  }),
  scenes: z.array(z.object({ visual: LooseVisual, lines: z.array(z.object({ who: z.enum(["penny", "patch"]), text: s })) })),
});

const cut = (v: string, n: number) => (v.length > n ? v.slice(0, n - 1).trimEnd() + "…" : v);

/** Clamp lengths/counts to the strict schema, drop empty lines and scenes, then validate. */
export function normalizeScript(raw: z.infer<typeof LooseScript>): Script {
  const p = raw.plan;
  const plan = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === "type" ? v : cut(String(v), 120)])) as Script["plan"];
  const scenes = raw.scenes
    .map((sc) => {
      const v = sc.visual;
      const amt = (a: { label: string; amount: string }) => ({ label: cut(a.label, 60), amount: cut(a.amount, 40) });
      let visual: Script["scenes"][number]["visual"];
      switch (v.kind) {
        case "title":
          visual = { kind: "title", title: cut(v.title, 80), subtitle: cut(v.subtitle, 160) };
          break;
        case "meter":
        case "shield":
          visual = { kind: v.kind, label: cut(v.label, 40), amount: cut(v.amount, 40), note: cut(v.note, v.kind === "meter" ? 160 : 200) };
          break;
        case "prices":
          visual = { kind: "prices", title: cut(v.title, 60), items: v.items.slice(0, 5).map(amt) };
          break;
        case "split": {
          const you = Math.max(0, Math.min(100, Math.round(v.you)));
          visual = { kind: "split", title: cut(v.title, 60), you, plan: 100 - you };
          break;
        }
        case "story":
          visual = { kind: "story", title: cut(v.title, 80), rows: v.rows.slice(0, 6).map(amt), total: cut(v.total, 40) };
          break;
        case "list":
          visual = { kind: "list", tone: v.tone, title: cut(v.title, 60), items: v.items.filter(Boolean).slice(0, 6).map((i) => cut(i, 120)) };
          break;
        case "quiz":
          visual = {
            kind: "quiz",
            question: cut(v.question, 200),
            options: v.options.slice(0, 3).map((o) => cut(o, 100)),
            answer: Math.max(0, Math.min(2, v.answer)),
          };
          break;
      }
      const lines = sc.lines
        .map((l) => ({ who: l.who, text: cut(l.text.trim(), 199) }))
        .filter((l) => l.text)
        .slice(0, 3);
      return { visual, lines };
    })
    .filter((sc) => sc.lines.length > 0 && Visual_ok(sc.visual))
    .slice(0, 12);
  return ExplainerScript.parse({ plan, scenes });
}
// Drop visuals the strict schema would reject (e.g. an empty prices list or a quiz without 3 options).
function Visual_ok(v: Script["scenes"][number]["visual"]) {
  if (v.kind === "prices") return v.items.length > 0;
  if (v.kind === "story") return v.rows.length > 0;
  if (v.kind === "list") return v.items.length > 0;
  if (v.kind === "quiz") return v.options.length === 3;
  return true;
}


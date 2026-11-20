import type { ExplainerScript } from "./schema";

/**
 * Number check: every dollar amount and percentage in the script must appear
 * in the SBC text. Comparison is by numeric value, so "$1,500" matches
 * "$1,500.00" and "20%" matches "20 %".
 */

export type NumberIssue = {
  kind: "dollar" | "percent";
  /** Canonical form, e.g. "$1500" or "20%". Used as the confirmation key. */
  key: string;
  /** As written in the script. */
  display: string;
  /** Where it appears, e.g. "Scene 2 · line 1" or "Scene 4 · visual". */
  where: string[];
};

const DOLLAR = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
const PERCENT = /(\d{1,3}(?:\.\d+)?)\s?(?:%|percent\b)/gi;

const dollarKey = (whole: string, cents?: string) => {
  const n = Number(whole.replace(/,/g, "")) + (cents ? Number(cents.padEnd(2, "0")) / 100 : 0);
  return "$" + (Number.isInteger(n) ? String(n) : n.toFixed(2));
};
const percentKey = (n: string) => String(Number(n)) + "%";

export function extractNumbers(text: string): { key: string; display: string; kind: NumberIssue["kind"] }[] {
  const out: { key: string; display: string; kind: NumberIssue["kind"] }[] = [];
  for (const m of text.matchAll(DOLLAR)) out.push({ kind: "dollar", key: dollarKey(m[1], m[2]), display: m[0].trim() });
  for (const m of text.matchAll(PERCENT)) out.push({ kind: "percent", key: percentKey(m[1]), display: m[0].trim() });
  return out;
}

/** Every string in a scene's visual, plus split percentages, as text. */
function visualText(v: ExplainerScript["scenes"][number]["visual"]): string[] {
  switch (v.kind) {
    case "title":
      return [v.title, v.subtitle];
    case "meter":
    case "shield":
      return [v.label, v.amount, v.note];
    case "prices":
      return [v.title, ...v.items.flatMap((i) => [i.label, i.amount])];
    case "split":
      return [v.title, `${v.you}%`, `${v.plan}%`];
    case "story":
      return [v.title, ...v.rows.flatMap((r) => [r.label, r.amount]), v.total];
    case "list":
      return [v.title, ...v.items];
    case "quiz":
      return [v.question, ...v.options];
  }
}

export function numberCheck(script: ExplainerScript, sbcText: string): NumberIssue[] {
  const inSbc = new Set(extractNumbers(sbcText).map((n) => n.key));
  // A stated coinsurance implies the plan's share (20% you -> 80% plan), and
  // "100%" / "0%" are implied by any SBC (the plan pays 100% after the OOP max).
  for (const k of [...inSbc]) if (k.endsWith("%")) inSbc.add(percentKey(String(100 - Number(k.slice(0, -1)))));
  inSbc.add("100%");
  inSbc.add("0%");
  const issues = new Map<string, NumberIssue>();
  const add = (text: string, where: string) => {
    for (const n of extractNumbers(text)) {
      if (inSbc.has(n.key)) continue;
      const cur = issues.get(n.key) ?? { kind: n.kind, key: n.key, display: n.display, where: [] };
      if (!cur.where.includes(where)) cur.where.push(where);
      issues.set(n.key, cur);
    }
  };
  for (const [k, v] of Object.entries(script.plan)) if (v) add(v, `Plan details · ${k}`);
  script.scenes.forEach((s, i) => {
    visualText(s.visual).forEach((t) => add(t, `Scene ${i + 1} · visual`));
    s.lines.forEach((l, j) => add(l.text, `Scene ${i + 1} · line ${j + 1}`));
  });
  return [...issues.values()];
}

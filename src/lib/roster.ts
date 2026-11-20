import { z } from "zod";
import { parseCsv } from "./csv";

export type RosterRow = { name: string; email: string; hireDate: string | null };
export type RosterParse = { rows: RosterRow[]; errors: { line: number; text: string; error: string }[] };

const Email = z.email();

/** Accepts YYYY-MM-DD, M/D/YYYY or M/D/YY. Returns YYYY-MM-DD or null if blank; throws on bad input. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mm: RegExpMatchArray | null;
  if ((mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [+mm[1], +mm[2], +mm[3]];
  else if ((mm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    [m, d, y] = [+mm[1], +mm[2], +mm[3]];
    if (y < 100) y += y > 50 ? 1900 : 2000;
  } else throw new Error(`"${s}" isn't a date (use YYYY-MM-DD or MM/DD/YYYY)`);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error(`"${s}" isn't a real date`);
  return dt.toISOString().slice(0, 10);
}

/**
 * Roster import from pasted text or a CSV file: name, email, hire date.
 * Comma or tab separated (pasting from a spreadsheet gives tabs). A header row is
 * detected and used to find the columns in any order; "First"/"Last" columns are joined.
 */
export function parseRoster(text: string): RosterParse {
  const delimiter = text.includes("\t") && !text.split("\n")[0].includes(",") ? "\t" : ",";
  const table = parseCsv(text, delimiter).map((r) => r.map((c) => c.trim()));
  const out: RosterParse = { rows: [], errors: [] };
  if (!table.length) return out;

  let col = { name: 0, first: -1, last: -1, email: 1, hire: 2 };
  let start = 0;
  const head = table[0].map((h) => h.toLowerCase());
  if (!head.some((h) => h.includes("@"))) {
    const find = (re: RegExp) => head.findIndex((h) => re.test(h));
    col = {
      name: find(/^(full )?name$|employee/),
      first: find(/first/),
      last: find(/last/),
      email: find(/e-?mail/),
      hire: find(/hire|start/),
    };
    start = 1;
    if (col.email < 0) {
      out.errors.push({ line: 1, text: table[0].join(", "), error: "Couldn't find an email column in the header row." });
      return out;
    }
  }

  const seen = new Set<string>();
  for (let i = start; i < table.length; i++) {
    const r = table[i];
    const line = i + 1;
    const name = (col.name >= 0 ? r[col.name] : [r[col.first], r[col.last]].filter(Boolean).join(" ")) ?? "";
    const email = (r[col.email] ?? "").toLowerCase();
    try {
      if (!name) throw new Error("Missing name");
      if (!Email.safeParse(email).success) throw new Error(`"${email || "(blank)"}" isn't a valid email`);
      if (seen.has(email)) throw new Error("Duplicate email in this import");
      seen.add(email);
      out.rows.push({ name: name.slice(0, 120), email, hireDate: col.hire >= 0 ? parseDate(r[col.hire] ?? "") : null });
    } catch (e) {
      out.errors.push({ line, text: r.join(", "), error: (e as Error).message });
    }
  }
  return out;
}

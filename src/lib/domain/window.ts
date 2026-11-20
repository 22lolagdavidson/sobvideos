export type WindowState = { key: "soon" | "open" | "closed"; label: string; open: boolean };

/** YYYY-MM-DD for a @db.Date value (stored at UTC midnight). */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const iso = typeof d === "string" ? d.slice(0, 10) : isoDate(d);
  const x = new Date(iso + "T12:00:00Z");
  return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

/**
 * Employees may submit or change an election from windowStart through windowEnd
 * (inclusive, by calendar date). `today` is a YYYY-MM-DD string so callers can
 * pass the group's local date; it defaults to UTC today.
 */
export function windowState(
  g: { windowStart: Date; windowEnd: Date },
  today: string = new Date().toISOString().slice(0, 10),
): WindowState {
  const start = isoDate(g.windowStart);
  const end = isoDate(g.windowEnd);
  if (today < start) return { key: "soon", label: "Opens " + fmtDate(start), open: false };
  if (today > end) return { key: "closed", label: "Closed " + fmtDate(end), open: false };
  return { key: "open", label: "Open until " + fmtDate(end), open: true };
}

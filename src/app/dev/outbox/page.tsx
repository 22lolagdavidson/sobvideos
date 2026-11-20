import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { DEV_OUTBOX } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev outbox" };

type Stored = { to: string; subject: string; text: string; sentAt: string };

/** Local-only list of emails that would have been sent. 404 in production or when SMTP is configured. */
export default async function Outbox() {
  if (process.env.NODE_ENV === "production" || process.env.EMAIL_SERVER) notFound();
  let files: string[] = [];
  try {
    files = (await readdir(DEV_OUTBOX)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 30);
  } catch {
    /* empty */
  }
  const mails = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(DEV_OUTBOX, f), "utf8")) as Stored),
  );
  const linkify = (t: string) =>
    t.split(/(https?:\/\/\S+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part}>
          {part.length > 80 ? "Open link" : part}
        </a>
      ) : (
        part
      ),
    );
  return (
    <div>
      <h1>Dev outbox</h1>
      <p className="muted">Newest first. Emails are written here because EMAIL_SERVER isn&apos;t set.</p>
      {mails.length === 0 && <div className="card">No emails yet.</div>}
      <div className="grid">
        {mails.map((m, i) => (
          <article key={i} className="card">
            <div className="row small muted">
              <span>To {m.to}</span>
              <span>·</span>
              <time dateTime={m.sentAt}>{new Date(m.sentAt).toLocaleString()}</time>
            </div>
            <h3 style={{ marginTop: 6 }}>{m.subject}</h3>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{linkify(m.text)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

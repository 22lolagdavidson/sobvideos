import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html?: string };

export const DEV_OUTBOX = path.join(process.cwd(), "storage", "dev-outbox");

/**
 * Sends email through EMAIL_SERVER (any SMTP URL). Without EMAIL_SERVER (local dev),
 * messages are written to storage/dev-outbox/ and listed at /dev/outbox instead.
 */
export async function sendMail(mail: Mail) {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM || "Open Enrollment Studio <no-reply@localhost>";
  if (server) {
    await nodemailer.createTransport(server).sendMail({ from, ...mail });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_SERVER is not set; refusing to drop email in production.");
  }
  await mkdir(DEV_OUTBOX, { recursive: true });
  const file = `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, "_")}.json`;
  await writeFile(path.join(DEV_OUTBOX, file), JSON.stringify({ from, sentAt: new Date().toISOString(), ...mail }, null, 2));
  console.log(`[mail:dev] to=${mail.to} subject="${mail.subject}" -> storage/dev-outbox/${file}`);
}

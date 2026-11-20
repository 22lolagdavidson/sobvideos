/**
 * Background worker: polls the Job table and renders explainer videos.
 *
 *   npm run worker
 *
 * Jobs are claimed with FOR UPDATE SKIP LOCKED, so several workers can run safely.
 */
import { hostname } from "node:os";
import { prisma } from "../src/lib/db";
import { renderExplainer } from "./render";
import { TtsError } from "./tts";

const WORKER_ID = `${hostname()}:${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 3000);
const MAX_ATTEMPTS = 3;
const STALE_MIN = 30;

type JobRow = { id: string; type: string; payload: { explainerId?: string }; attempts: number };

async function claim(): Promise<JobRow | null> {
  // Put back jobs whose worker died mid-render.
  await prisma.$executeRaw`UPDATE "Job" SET status = 'QUEUED', "lockedAt" = NULL, "lockedBy" = NULL
    WHERE status = 'RUNNING' AND "lockedAt" < now() - (${STALE_MIN} * interval '1 minute')`;
  const rows = await prisma.$queryRaw<JobRow[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = now(), "lockedBy" = ${WORKER_ID}, attempts = attempts + 1, "updatedAt" = now()
    WHERE id = (SELECT id FROM "Job" WHERE status = 'QUEUED' AND "runAt" <= now() ORDER BY "runAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, type, payload, attempts`;
  return rows[0] ?? null;
}

async function run(job: JobRow) {
  const log = (m: string) => console.log(`[job ${job.id}] ${m}`);
  log(`${job.type} attempt ${job.attempts}`);
  try {
    if (job.type !== "explainer.render" || !job.payload.explainerId) throw new Error(`Unknown job ${job.type}`);
    await renderExplainer(job.payload.explainerId, log);
    await prisma.job.update({ where: { id: job.id }, data: { status: "DONE", error: null } });
  } catch (e) {
    const err = e as Error;
    console.error(`[job ${job.id}]`, err);
    // Config problems (bad key, unknown provider) won't fix themselves, so don't retry them.
    const final = job.attempts >= MAX_ATTEMPTS || e instanceof TtsError;
    await prisma.job.update({
      where: { id: job.id },
      data: final
        ? { status: "FAILED", error: String(err.stack || err.message).slice(0, 4000) }
        : { status: "QUEUED", runAt: new Date(Date.now() + 30_000 * job.attempts), lockedAt: null, lockedBy: null, error: err.message },
    });
    if (final && job.payload.explainerId) {
      const msg = e instanceof TtsError ? err.message : "Something went wrong while making the video. Try again, and if it keeps failing, contact support.";
      await prisma.explainer.updateMany({ where: { id: job.payload.explainerId, status: "RENDERING" }, data: { status: "FAILED", renderError: msg } });
    }
  }
}

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    console.log("stopping after the current job…");
    stopping = true;
  });

async function main() {
  console.log(`worker ${WORKER_ID} polling every ${POLL_MS} ms (TTS_PROVIDER=${process.env.TTS_PROVIDER || "openai"})`);
  const once = process.argv.includes("--once");
  while (!stopping) {
    const job = await claim();
    if (job) await run(job);
    else if (once) break;
    else await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

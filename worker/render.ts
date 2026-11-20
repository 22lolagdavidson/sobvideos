import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Prisma } from "@prisma/client";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prisma } from "../src/lib/db";
import { getFile, putFile } from "../src/lib/storage";
import { ExplainerScript } from "../src/lib/explainer/schema";
import { buildTimeline, toWebVtt } from "../src/lib/explainer/timeline";
import { COMPOSITION_ID } from "../src/remotion/Root";
import { ttsProvider } from "./tts";
import { wavDurationSec } from "./wav";

const ROOT = path.resolve(__dirname, "..");
let bundled: Promise<string> | null = null;

/** Bundle the Remotion composition once per worker process. */
function getBundle() {
  bundled ??= bundle({
    entryPoint: path.join(ROOT, "src/remotion/index.ts"),
    publicDir: path.join(ROOT, "public"),
    webpackOverride: (c) => ({
      ...c,
      resolve: { ...c.resolve, alias: { ...(c.resolve?.alias as Record<string, string>), "@": path.join(ROOT, "src") } },
    }),
  });
  return bundled;
}

/** Serve the job's temp folder (audio, logo) to the headless browser on localhost only. */
function serveDir(dir: string): Promise<{ server: Server; base: string }> {
  const types: Record<string, string> = { ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg" };
  const server = createServer(async (req, res) => {
    const name = path.basename(decodeURIComponent((req.url || "/").split("?")[0]));
    try {
      const body = await readFile(path.join(dir, name));
      res.writeHead(200, { "Content-Type": types[path.extname(name)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

export async function renderExplainer(explainerId: string, log: (m: string) => void) {
  const ex = await prisma.explainer.findUnique({ where: { id: explainerId }, include: { plan: { include: { agency: true } } } });
  if (!ex) return log("explainer deleted; skipping");
  if (ex.status !== "RENDERING") return log(`explainer is ${ex.status}; skipping`);
  const script = ExplainerScript.parse(ex.script);
  const agency = ex.plan.agency;

  const dir = await mkdtemp(path.join(tmpdir(), "explainer-"));
  const { server, base } = await serveDir(dir);
  try {
    // 1) Voices: one WAV per line, measured for exact timing.
    const tts = ttsProvider();
    const seconds: number[][] = [];
    const files: string[][] = [];
    for (const [si, scene] of script.scenes.entries()) {
      seconds[si] = [];
      files[si] = [];
      for (const [li, line] of scene.lines.entries()) {
        const wav = await tts.speak(line.text, line.who);
        const name = `s${si}-l${li}.wav`;
        await writeFile(path.join(dir, name), wav);
        seconds[si][li] = wavDurationSec(wav);
        files[si][li] = name;
      }
    }
    log(`voices done (${tts.name})`);

    let logoUrl: string | null = null;
    if (agency.logoKey) {
      const name = `logo${path.extname(agency.logoKey)}`;
      await writeFile(path.join(dir, name), await getFile(agency.logoKey));
      logoUrl = `${base}/${name}`;
    }

    // 2) Timeline + render.
    const timeline = buildTimeline(script, (si, li) => seconds[si][li], (si, li) => `${base}/${files[si][li]}`);
    const inputProps = { script, timeline, agency: { name: agency.name, logoUrl }, planYear: ex.plan.planYear || undefined, captions: true };
    const serveUrl = await getBundle();
    const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });
    const out = path.join(dir, "video.mp4");
    let lastPct = -10;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: out,
      inputProps,
      browserExecutable,
      concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null,
      chromiumOptions: { gl: "swangle" },
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 100);
        if (pct >= lastPct + 10) log(`render ${(lastPct = pct)}%`);
      },
    });

    // 3) Store everything. Audio keys (not temp URLs) go in the saved timeline.
    const prefix = `explainers/${ex.id}`;
    for (const name of files.flat()) await putFile(`${prefix}/audio/${name}`, await readFile(path.join(dir, name)), "audio/wav");
    const mp4Key = `${prefix}/video.mp4`;
    const captionsKey = `${prefix}/captions.vtt`;
    await putFile(mp4Key, await readFile(out), "video/mp4");
    await putFile(captionsKey, Buffer.from(toWebVtt(timeline)), "text/vtt");
    const saved = buildTimeline(script, (si, li) => seconds[si][li], (si, li) => `${prefix}/audio/${files[si][li]}`);

    await prisma.explainer.update({
      where: { id: ex.id },
      data: { status: "READY", mp4Key, captionsKey, timeline: saved as unknown as Prisma.InputJsonValue, durationSec: timeline.totalFrames / timeline.fps, renderError: null },
    });
    log(`ready: ${(timeline.totalFrames / timeline.fps).toFixed(1)} s`);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

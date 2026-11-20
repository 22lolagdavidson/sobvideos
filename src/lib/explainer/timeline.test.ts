import { describe, expect, it } from "vitest";
import { buildTimeline, toWebVtt, FPS, END_CARD_SEC } from "./timeline";
import { goldPpoScript } from "../../../prisma/seed-data/explainer-gold-ppo";

describe("buildTimeline", () => {
  it("makes each scene its lines + gaps + 0.6 s padding, back to back, then a 3 s end card", () => {
    const tl = buildTimeline(goldPpoScript, () => 2);
    const s0 = tl.scenes[0]; // 2 lines
    expect(s0.from).toBe(0);
    expect(s0.duration).toBe(Math.round(0.3 * FPS) + 2 * 2 * FPS + Math.round(0.15 * FPS) + Math.round(0.6 * FPS));
    expect(tl.scenes[1].from).toBe(s0.from + s0.duration);
    expect(tl.totalFrames - tl.endCardFrom).toBe(END_CARD_SEC * FPS);
    // lines never overlap
    for (const s of tl.scenes)
      for (let i = 1; i < s.lines.length; i++) expect(s.lines[i].from).toBeGreaterThanOrEqual(s.lines[i - 1].from + s.lines[i - 1].duration);
  });
  it("writes WebVTT with speaker voices", () => {
    const vtt = toWebVtt(buildTimeline(goldPpoScript, () => 2));
    expect(vtt.startsWith("WEBVTT\n\n00:00:00.300 --> 00:00:02.300\n<v Penny>")).toBe(true);
    expect(vtt).toContain("official description of coverage");
  });
});

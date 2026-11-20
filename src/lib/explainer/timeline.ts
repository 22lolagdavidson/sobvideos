import type { ExplainerScript } from "./schema";

/**
 * Turns a script plus per-line audio durations into frame timings for the video.
 * Each scene lasts as long as its lines plus 0.6 s of padding; a 3 s end card follows.
 * The same timeline drives the in-browser preview (estimated durations, no audio),
 * the rendered MP4, and the WebVTT captions, so they always line up.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const SCENE_PADDING_SEC = 0.6;
export const LINE_GAP_SEC = 0.15;
export const END_CARD_SEC = 3;

export type TimedLine = {
  who: "penny" | "patch";
  text: string;
  from: number; // frame, absolute
  duration: number; // frames
  audio?: string; // URL of this line's audio (absent in preview)
};
export type TimedScene = { index: number; from: number; duration: number; lines: TimedLine[] };
export type Timeline = { fps: number; scenes: TimedScene[]; endCardFrom: number; totalFrames: number };

/** Rough speaking time when there's no audio yet (preview): ~15 characters a second, min 1.5 s. */
export const estimateSeconds = (text: string) => Math.max(1.5, text.length / 15);

export function buildTimeline(
  script: ExplainerScript,
  lineSeconds: (sceneIdx: number, lineIdx: number, text: string) => number = (_s, _l, t) => estimateSeconds(t),
  audioUrl?: (sceneIdx: number, lineIdx: number) => string | undefined,
): Timeline {
  const f = (sec: number) => Math.round(sec * FPS);
  let cursor = 0;
  const scenes: TimedScene[] = script.scenes.map((sc, si) => {
    const start = cursor;
    let t = start + f(0.3); // let the visual pop in before the first line
    const lines = sc.lines.map((ln, li) => {
      const d = Math.max(1, f(lineSeconds(si, li, ln.text)));
      const line: TimedLine = { who: ln.who, text: ln.text, from: t, duration: d, audio: audioUrl?.(si, li) };
      t += d + f(LINE_GAP_SEC);
      return line;
    });
    const duration = t - f(LINE_GAP_SEC) - start + f(SCENE_PADDING_SEC);
    cursor = start + duration;
    return { index: si, from: start, duration, lines };
  });
  return { fps: FPS, scenes, endCardFrom: cursor, totalFrames: cursor + f(END_CARD_SEC) };
}

const ts = (frame: number) => {
  const ms = Math.round((frame / FPS) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(r, 3)}`;
};

export const END_CARD_TEXT =
  "This video is a plain-language summary. Your plan documents are the official description of coverage.";

/** WebVTT captions, one cue per line, with the speaker as a voice tag. */
export function toWebVtt(tl: Timeline): string {
  const cues = tl.scenes.flatMap((s) =>
    s.lines.map((l) => {
      const name = l.who === "penny" ? "Penny" : "Patch";
      return `${ts(l.from)} --> ${ts(l.from + l.duration)}\n<v ${name}>${l.text.replace(/</g, "&lt;")}`;
    }),
  );
  cues.push(`${ts(tl.endCardFrom)} --> ${ts(tl.totalFrames)}\n${END_CARD_TEXT}`);
  return "WEBVTT\n\n" + cues.join("\n\n") + "\n";
}

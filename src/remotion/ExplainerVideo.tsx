import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ExplainerScript } from "@/lib/explainer/schema";
import { END_CARD_TEXT, type Timeline, type TimedLine } from "@/lib/explainer/timeline";
import { Patch, Penny } from "@/components/characters/Characters";
import { Panel } from "./Panels";
import { pop, slideUp } from "./anim";
import { baloo, inter } from "./fonts";

export type ExplainerVideoProps = {
  script: ExplainerScript;
  timeline: Timeline;
  agency: { name: string; logoUrl?: string | null };
  planYear?: string;
  /** Burn captions into the frames (the MP4 always does; the preview can show them too). */
  captions?: boolean;
};

// Design space is the prototype's 960×540 stage, scaled up to the 1920×1080 frame.
const W = 960;
const H = 540;

function speaking(lines: TimedLine[], frame: number) {
  return lines.find((l) => frame >= l.from && frame < l.from + l.duration) ?? null;
}

function Character({ who, talking, frame, x, y, scale }: { who: "penny" | "patch"; talking: boolean; frame: number; x: number; y: number; scale: number }) {
  const { fps } = useVideoConfig();
  // Bob while talking; mouth flaps ~5 times a second; both blink every ~4.6 s (offset per character).
  const bob = talking ? Math.sin((frame / fps) * Math.PI * 2) : 0;
  const mouth = talking ? 0.25 + 0.75 * Math.abs(Math.sin((frame / fps) * Math.PI * 5)) : 0.15;
  const period = Math.round(4.6 * fps);
  const blink = (frame + (who === "patch" ? Math.round(1.7 * fps) : 0)) % period > period - 4;
  return (
    <g transform={`translate(${x} ${y - 4 - 4 * bob}) rotate(${1.5 * bob}) scale(${scale})`}>
      {who === "penny" ? <Penny mouthOpen={mouth} eyesClosed={blink} /> : <Patch mouthOpen={mouth} eyesClosed={blink} />}
    </g>
  );
}

function Backdrop({ frame }: { frame: number }) {
  const f = (d: number) => Math.sin(frame / 30 + d) * 7;
  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3ff" />
          <stop offset="1" stopColor="#eaf6ff" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      <g opacity={0.55}>
        <g transform={`translate(0 ${f(0)})`}>
          <rect x={70} y={60} width={16} height={44} rx={5} fill="#fff" />
          <rect x={56} y={74} width={44} height={16} rx={5} fill="#fff" />
        </g>
        <g transform={`translate(0 ${f(2)})`}>
          <circle cx={880} cy={90} r={22} fill="#ffd34a" stroke="#fff" strokeWidth={5} />
          <text x={880} y={99} textAnchor="middle" fontFamily={baloo} fontWeight={800} fontSize={24} fill="#fff">
            $
          </text>
        </g>
        <g transform={`translate(0 ${f(4)})`}>
          <rect x={836} y={230} width={12} height={34} rx={4} fill="#fff" />
          <rect x={825} y={241} width={34} height={12} rx={4} fill="#fff" />
        </g>
        <g transform={`translate(0 ${f(3)})`}>
          <circle cx={120} cy={250} r={16} fill="#ffd34a" stroke="#fff" strokeWidth={4} />
        </g>
      </g>
      <path d="M0 470 Q240 430 480 462 T960 452 V540 H0Z" fill="#9fd88a" />
      <path d="M0 498 Q300 470 600 494 T960 486 V540 H0Z" fill="#7cc46a" />
    </>
  );
}

function Caption({ line }: { line: TimedLine | null }) {
  if (!line) return null;
  const penny = line.who === "penny";
  return (
    <div
      style={{
        position: "absolute",
        left: 205,
        width: 550,
        bottom: 12,
        background: "rgba(20,27,61,.92)",
        color: "#fff",
        borderRadius: 12,
        padding: "8px 14px",
        fontFamily: inter,
        fontSize: 17,
        fontWeight: 600,
        lineHeight: 1.3,
        textAlign: "left",
      }}
    >
      <span style={{ fontFamily: baloo, fontWeight: 800, color: penny ? "#ffb3cd" : "#ffd9a8", marginRight: 8 }}>{penny ? "Penny" : "Patch"}:</span>
      {line.text}
    </div>
  );
}

function EndCard({ agency }: { agency: ExplainerVideoProps["agency"] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#1b3f94,#2b59c3 60%,#3f7be0)", color: "#fff", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 60 }}>
      {agency.logoUrl && <Img src={agency.logoUrl} style={{ ...pop(frame, fps), maxHeight: 90, maxWidth: 300, marginBottom: 18, background: "#fff", borderRadius: 14, padding: 10 }} />}
      <div style={{ ...pop(frame, fps, 0.1), fontFamily: baloo, fontSize: 40, fontWeight: 800 }}>{agency.name}</div>
      <div style={{ ...slideUp(frame, fps, 0.4), fontFamily: inter, fontSize: 22, fontWeight: 500, maxWidth: 700, marginTop: 14, lineHeight: 1.4 }}>{END_CARD_TEXT}</div>
    </AbsoluteFill>
  );
}

export function ExplainerVideo({ script, timeline, agency, planYear, captions = true }: ExplainerVideoProps) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const scale = width / W;
  const scene = timeline.scenes.find((s) => frame >= s.from && frame < s.from + s.duration) ?? null;
  const line = scene ? speaking(scene.lines, frame) : null;
  const fadeOut = interpolate(frame, [timeline.endCardFrom - 8, timeline.endCardFrom], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#bfe3ff" }}>
      {/* Audio: one clip per line, placed at its start frame. */}
      {timeline.scenes.flatMap((s) =>
        s.lines.map((l, i) =>
          l.audio ? (
            <Sequence key={`${s.index}-${i}`} from={l.from} durationInFrames={l.duration} layout="none">
              <Audio src={l.audio} />
            </Sequence>
          ) : null,
        ),
      )}

      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", opacity: fadeOut }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <Backdrop frame={frame} />
          <rect x={210} y={34} width={540} height={420} rx={26} fill="#fff" opacity={0.92} stroke="#1d2340" strokeWidth={5} />
          <Character who="penny" talking={line?.who === "penny"} frame={frame} x={105} y={420} scale={0.95} />
          <Character who="patch" talking={line?.who === "patch"} frame={frame} x={870} y={382} scale={0.82} />
        </svg>
        {timeline.scenes.map((s) => (
          <Sequence key={s.index} from={s.from} durationInFrames={s.duration} layout="none">
            <div style={{ position: "absolute", left: 215, top: 39, width: 530, height: 410 }}>
              <Panel
                v={script.scenes[s.index].visual}
                planYear={planYear}
                reveal={script.scenes[s.index].visual.kind === "quiz" && frame >= (s.lines[s.lines.length - 1]?.from ?? s.from)}
              />
            </div>
          </Sequence>
        ))}
        {captions && <Caption line={line} />}
      </div>

      <Sequence from={timeline.endCardFrom}>
        <EndCard agency={agency} />
      </Sequence>
    </AbsoluteFill>
  );
}

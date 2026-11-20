"use client";
import { useMemo } from "react";
import { Player } from "@remotion/player";
import { ExplainerVideo, type ExplainerVideoProps } from "@/remotion/ExplainerVideo";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "@/lib/explainer/timeline";
import type { ExplainerScript } from "@/lib/explainer/schema";

/** In-browser preview of the same composition the worker renders. No voices: lines are timed by length. */
export function Preview({ script, agency, planYear }: { script: ExplainerScript; agency: ExplainerVideoProps["agency"]; planYear?: string }) {
  const timeline = useMemo(() => buildTimeline(script), [script]);
  const inputProps = useMemo(() => ({ script, timeline, agency, planYear, captions: true }), [script, timeline, agency, planYear]);
  return (
    <div>
      <Player
        component={ExplainerVideo}
        inputProps={inputProps}
        durationInFrames={timeline.totalFrames}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}
        controls
        clickToPlay
        acknowledgeRemotionLicense
      />
      <p className="small muted" style={{ marginTop: 6 }}>
        Preview without voices ({Math.round(timeline.totalFrames / FPS)} s). The final video&apos;s timing follows the recorded voices.
      </p>
    </div>
  );
}

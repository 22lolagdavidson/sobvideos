import React from "react";
import { Composition } from "remotion";
import { ExplainerVideo, type ExplainerVideoProps } from "./ExplainerVideo";
import { FPS, HEIGHT, WIDTH } from "@/lib/explainer/timeline";

export const COMPOSITION_ID = "Explainer";

/** Remotion entry for server-side rendering (the worker bundles this). */
export function RemotionRoot() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={ExplainerVideo as unknown as React.FC<Record<string, unknown>>}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={{} as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as unknown as ExplainerVideoProps).timeline.totalFrames })}
    />
  );
}

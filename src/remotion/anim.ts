import { interpolate, spring, Easing } from "remotion";

/** Entrance animations from the prototype, as pure functions of the scene-local frame. */
export function pop(frame: number, fps: number, delaySec = 0) {
  const s = spring({ frame: frame - delaySec * fps, fps, config: { damping: 9, stiffness: 170, mass: 0.6 } });
  return { transform: `scale(${0.4 + 0.6 * s})`, opacity: Math.min(1, s * 1.5) };
}
export function slideUp(frame: number, fps: number, delaySec = 0) {
  const t = interpolate(frame, [delaySec * fps, (delaySec + 0.5) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { transform: `translateY(${(1 - t) * 30}px)`, opacity: t };
}
/** 0→1 progress with easing, for jar fill and bar growth. */
export function grow(frame: number, fps: number, delaySec: number, durSec: number) {
  return interpolate(frame, [delaySec * fps, (delaySec + durSec) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}

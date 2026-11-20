import { describe, expect, it } from "vitest";
import { pcmToWav, silentWav, wavDurationSec } from "./wav";

describe("wav", () => {
  it("measures silence it generated", () => {
    expect(wavDurationSec(silentWav(2.5))).toBeCloseTo(2.5, 3);
  });
  it("wraps 44.1 kHz PCM (ElevenLabs) with the right duration", () => {
    const wav = pcmToWav(Buffer.alloc(44100 * 2 * 3), 44100);
    expect(wavDurationSec(wav)).toBeCloseTo(3, 5);
  });
  it("handles streamed WAVs whose data size is 0xFFFFFFFF", () => {
    const wav = silentWav(1);
    wav.writeUInt32LE(0xffffffff, 40);
    expect(wavDurationSec(wav)).toBeCloseTo(1, 3);
  });
  it("rejects non-WAV data", () => {
    expect(() => wavDurationSec(Buffer.from("not a wav file at all, nope"))).toThrow();
  });
});

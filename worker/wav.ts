/** Minimal WAV helpers: duration from a WAV file, PCM→WAV wrapping, and silence. */

export function wavDurationSec(buf: Buffer): number {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAV file");
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") {
      if (!byteRate) throw new Error("WAV has no fmt chunk");
      // Streamed WAVs (e.g. OpenAI) may put 0xFFFFFFFF here, so use the bytes actually present.
      const bytes = Math.min(size, buf.length - (off + 8));
      return bytes / byteRate;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16): Buffer {
  const h = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE((channels * bits) / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function silentWav(seconds: number, sampleRate = 24000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  return pcmToWav(Buffer.alloc(samples * 2), sampleRate);
}

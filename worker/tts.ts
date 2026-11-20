import { estimateSeconds } from "../src/lib/explainer/timeline";
import { pcmToWav, silentWav } from "./wav";

/**
 * Text-to-speech for Penny and Patch. Only the script's dialogue text is sent, never
 * employee data. Every provider returns a WAV so the worker can measure exact durations.
 *
 *   TTS_PROVIDER=openai      OpenAI gpt-4o-mini-tts (OPENAI_API_KEY, OPENAI_VOICE_PENNY/PATCH)
 *   TTS_PROVIDER=elevenlabs  ElevenLabs (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_PENNY/PATCH)
 *   TTS_PROVIDER=silent      No voices: silent audio timed to the text (dev and tests)
 */
export type Who = "penny" | "patch";

export interface TtsProvider {
  name: string;
  speak(text: string, who: Who): Promise<Buffer>;
}

export class TtsError extends Error {}

const STYLE: Record<Who, string> = {
  penny: "Voice of Penny, a curious, bubbly cartoon piggy bank. Bright, warm and playful, asking questions with genuine wonder. Medium pace.",
  patch: "Voice of Patch, a cheerful, reassuring cartoon bandage. Friendly, clear and encouraging, like a favorite teacher. Medium pace.",
};

async function check(res: Response, provider: string) {
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 300);
  if (res.status === 401 || res.status === 403) throw new TtsError(`${provider} rejected the API key. Check the voice settings on the server.`);
  if (res.status === 429) throw new TtsError(`${provider} is rate limiting voice requests. Try again in a few minutes.`);
  throw new TtsError(`${provider} voice request failed (${res.status}): ${body}`);
}

function openai(): TtsProvider {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new TtsError("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice: Record<Who, string> = { penny: process.env.OPENAI_VOICE_PENNY || "coral", patch: process.env.OPENAI_VOICE_PATCH || "echo" };
  return {
    name: "openai",
    async speak(text, who) {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice: voice[who], input: text, instructions: STYLE[who], response_format: "wav" }),
      });
      await check(res, "OpenAI");
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

function elevenlabs(): TtsProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice: Record<Who, string | undefined> = { penny: process.env.ELEVENLABS_VOICE_PENNY, patch: process.env.ELEVENLABS_VOICE_PATCH };
  if (!key) throw new TtsError("ELEVENLABS_API_KEY is not set.");
  if (!voice.penny || !voice.patch) throw new TtsError("Set ELEVENLABS_VOICE_PENNY and ELEVENLABS_VOICE_PATCH to voice IDs.");
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  return {
    name: "elevenlabs",
    async speak(text, who) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice[who]!)}?output_format=pcm_44100`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model }),
      });
      await check(res, "ElevenLabs");
      return pcmToWav(Buffer.from(await res.arrayBuffer()), 44100);
    },
  };
}

const silent: TtsProvider = { name: "silent", speak: async (text) => silentWav(estimateSeconds(text)) };

export function ttsProvider(): TtsProvider {
  const p = (process.env.TTS_PROVIDER || "openai").toLowerCase();
  if (p === "openai") return openai();
  if (p === "elevenlabs") return elevenlabs();
  if (p === "silent") return silent;
  throw new TtsError(`Unknown TTS_PROVIDER "${p}". Use openai, elevenlabs or silent.`);
}

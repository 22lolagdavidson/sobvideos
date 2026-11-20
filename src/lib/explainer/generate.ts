import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ExplainerScript as Script } from "./schema";
import { LooseScript, normalizeScript } from "./normalize";
import { SYSTEM_PROMPT, userInstruction } from "./prompt";

// Claude reads the plan document and returns the script as structured output.
// Only the plan document leaves our servers: no employee or user data is sent.


export class GenerateError extends Error {}

export type GenerateInput =
  | { kind: "text"; text: string; planName: string }
  | { kind: "pdf"; pdf: Buffer; planName: string }; // scanned PDF: Claude reads the page images

export async function generateScript(input: GenerateInput): Promise<Script> {
  if (!process.env.ANTHROPIC_API_KEY) throw new GenerateError("ANTHROPIC_API_KEY isn't set, so scripts can't be generated.");
  const client = new Anthropic();
  const doc: Anthropic.ContentBlockParam =
    input.kind === "text"
      ? { type: "text", text: `<plan_document>\n${input.text}\n</plan_document>` }
      : { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdf.toString("base64") } };

  let response;
  try {
    response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(LooseScript) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [doc, { type: "text", text: userInstruction(input.planName) }] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new GenerateError("Claude is busy right now. Try again in a minute.");
    if (e instanceof Anthropic.AuthenticationError) throw new GenerateError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.BadRequestError) throw new GenerateError(`Claude couldn't read this document (${e.message}).`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new GenerateError("Claude declined to write a script for this document.");
  if (response.stop_reason === "max_tokens") throw new GenerateError("The script came back incomplete. Try again.");
  if (!response.parsed_output) throw new GenerateError("The script came back in the wrong shape. Try again.");
  try {
    return normalizeScript(response.parsed_output);
  } catch {
    throw new GenerateError("The script was missing required parts (it needs at least 3 scenes). Try again.");
  }
}

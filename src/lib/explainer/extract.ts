import "server-only";
import { PDFParse } from "pdf-parse";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
/** Below this many characters we treat the PDF as scanned and let Claude read the page images. */
export const MIN_TEXT_CHARS = 300;

/** True if the bytes are a PDF (magic number check; never trust the file name or browser type). */
export const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";

export async function extractPdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const r = await parser.getText();
    const text = r.pages
      .map((p) => `--- page ${p.num} ---\n${p.text}`)
      .join("\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // Only count real characters, not our page markers, toward "has a text layer".
    const real = r.pages.map((p) => p.text).join("").replace(/\s+/g, "");
    return { text: real.length >= MIN_TEXT_CHARS ? text : "", pages: r.total };
  } finally {
    await parser.destroy();
  }
}

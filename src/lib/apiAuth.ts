import "server-only";
import { auth } from "@/auth";
import { getFile } from "@/lib/storage";

/** Signed-in agency user for route handlers (returns null instead of redirecting). */
export async function apiUser() {
  const s = await auth();
  if (!s?.user?.id || !s.user.agencyId) return null;
  return s.user as typeof s.user & { agencyId: string };
}

/** Serve a stored file, with HTTP Range support so <video> can seek. */
export async function serveFile(req: Request, key: string, type: string, opts: { download?: string } = {}) {
  let buf: Buffer;
  try {
    buf = await getFile(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (opts.download) headers["Content-Disposition"] = `attachment; filename="${opts.download.replace(/[^\w .()-]+/g, "_")}"`;
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const size = buf.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Length": String(buf.length) } });
}

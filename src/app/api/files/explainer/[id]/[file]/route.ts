import { prisma } from "@/lib/db";
import { apiUser, serveFile } from "@/lib/apiAuth";

/** /api/files/explainer/<id>/video.mp4 and /captions.vtt (add ?download=1 to download). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const user = await apiUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id, file } = await params;
  const ex = await prisma.explainer.findFirst({
    where: { id, status: "READY", plan: { agencyId: user.agencyId } },
    include: { plan: { select: { name: true } } },
  });
  if (!ex) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const base = `${ex.plan.name} explainer`;
  if (file === "video.mp4" && ex.mp4Key) return serveFile(req, ex.mp4Key, "video/mp4", { download: download ? `${base}.mp4` : undefined });
  if (file === "captions.vtt" && ex.captionsKey) return serveFile(req, ex.captionsKey, "text/vtt; charset=utf-8", { download: download ? `${base}.vtt` : undefined });
  return new Response("Not found", { status: 404 });
}

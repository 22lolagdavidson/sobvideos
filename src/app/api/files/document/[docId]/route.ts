import { prisma } from "@/lib/db";
import { apiUser, serveFile } from "@/lib/apiAuth";

export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const user = await apiUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { docId } = await params;
  const doc = await prisma.benefitDocument.findFirst({ where: { id: docId, plan: { agencyId: user.agencyId } } });
  if (!doc) return new Response("Not found", { status: 404 });
  return serveFile(req, doc.fileKey, doc.fileKey.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/pdf");
}

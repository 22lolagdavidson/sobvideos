import { prisma } from "@/lib/db";
import { apiUser, serveFile } from "@/lib/apiAuth";

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const agency = await prisma.agency.findUnique({ where: { id: user.agencyId }, select: { logoKey: true } });
  if (!agency?.logoKey) return new Response("Not found", { status: 404 });
  return serveFile(req, agency.logoKey, agency.logoKey.endsWith(".png") ? "image/png" : "image/jpeg");
}

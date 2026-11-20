import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type SessionUser = Session["user"];

/** Signed-in user who belongs to an agency, or redirect to sign-in. */
export async function requireUser(): Promise<SessionUser & { agencyId: string }> {
  const s = await auth();
  if (!s?.user?.id) redirect("/signin");
  if (!s.user.agencyId) redirect("/no-access");
  return s.user as SessionUser & { agencyId: string };
}

/** A plan in the user's agency, or 404. Every plan query goes through here. */
export async function requirePlan(planId: string) {
  const user = await requireUser();
  const plan = await prisma.plan.findFirst({ where: { id: planId, agencyId: user.agencyId } });
  if (!plan) notFound();
  return { user, plan };
}

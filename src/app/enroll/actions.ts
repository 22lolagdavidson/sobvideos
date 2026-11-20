"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwnEmployee } from "@/lib/authz";
import { ElectionInput } from "@/lib/validation/election";
import { ElectionError, recordElection } from "@/lib/server/elections";
import { sendElectionConfirmation } from "@/lib/server/emails";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/** The employee's own submission from the wizard. Everything is re-validated here. */
export async function submitMyElection(raw: unknown): Promise<SubmitResult> {
  const { user, employee } = await requireOwnEmployee();
  const parsed = ElectionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your answers." };
  const h = await headers();
  try {
    const election = await recordElection(parsed.data, {
      actor: user,
      employee,
      source: "EMPLOYEE",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    });
    const [plan, agency] = await Promise.all([
      election.planId ? prisma.plan.findUnique({ where: { id: election.planId } }) : null,
      prisma.agency.findUniqueOrThrow({ where: { id: employee.group.agencyId }, select: { name: true, contactEmail: true } }),
    ]);
    try {
      await sendElectionConfirmation({ employee, group: employee.group, agency, election, plan });
    } catch (e) {
      console.error("[mail] confirmation failed", e); // the election is saved; don't fail the submit
    }
  } catch (e) {
    if (e instanceof ElectionError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/enroll");
  return { ok: true };
}

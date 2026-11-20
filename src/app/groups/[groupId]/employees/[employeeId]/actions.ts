"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminGroup } from "@/lib/authz";
import { ElectionInput } from "@/lib/validation/election";
import { ElectionError, recordElection } from "@/lib/server/elections";

/** Admin enters or changes an election. Allowed any time (window ignored); always audit-logged. */
export async function adminEnterElection(
  groupId: string,
  employeeId: string,
  raw: unknown,
  adminNote: string,
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireAdminGroup(groupId);
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, groupId }, include: { group: true } });
  if (!employee) return { ok: false, error: "Employee not found." };
  // Admins attest with their own identity; the typed-name rule applies to employees only.
  const parsed = ElectionInput.safeParse({ ...(raw as object), attest: true, signatureName: user.name || user.email || "admin" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  try {
    await recordElection(parsed.data, { actor: user, employee, source: "ADMIN", adminNote });
  } catch (e) {
    if (e instanceof ElectionError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/employees/${employeeId}`);
  return { ok: true };
}

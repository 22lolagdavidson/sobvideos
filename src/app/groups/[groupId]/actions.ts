"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdminGroup } from "@/lib/authz";
import { employeesWithLatest } from "@/lib/server/groupStats";
import { sendEnrollmentReminder } from "@/lib/server/emails";
import { windowState } from "@/lib/domain/window";

/** Email everyone eligible who hasn't enrolled or waived yet. */
export async function remindPending(groupId: string): Promise<{ ok: boolean; message: string }> {
  const { user, group } = await requireAdminGroup(groupId);
  if (windowState(group).key === "closed") return { ok: false, message: "Enrollment is closed, so reminders weren't sent." };
  const pending = (await employeesWithLatest(group.id)).filter((e) => e.eligible && !e.latest);
  if (!pending.length) return { ok: true, message: "Nobody is pending. No emails sent." };
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: group.agencyId }, select: { name: true } });
  let sent = 0;
  const failed: string[] = [];
  for (const employee of pending) {
    try {
      await sendEnrollmentReminder({ employee, group, agency });
      sent++;
    } catch {
      failed.push(employee.email);
    }
  }
  await audit({
    actor: user,
    action: "group.remind_pending",
    entity: "EmployerGroup",
    entityId: group.id,
    groupId: group.id,
    after: { sent, failed, to: pending.map((e) => e.email) },
  });
  revalidatePath(`/groups/${groupId}`);
  return failed.length
    ? { ok: false, message: `Sent ${sent} reminder${sent === 1 ? "" : "s"}. ${failed.length} failed: ${failed.join(", ")}` }
    : { ok: true, message: `Sent ${sent} reminder${sent === 1 ? "" : "s"}.` };
}

import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Strip Decimal/Date to plain JSON so before/after snapshots are readable. */
const snap = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v));

export async function audit(
  entry: {
    actor: SessionUser | null;
    action: string;
    entity: string;
    entityId?: string | null;
    agencyId?: string | null;
    groupId?: string | null;
    before?: unknown;
    after?: unknown;
  },
  tx: Tx = prisma,
) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  } catch {
    // outside a request (worker, seed)
  }
  await tx.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorEmail: entry.actor?.email ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      agencyId: entry.agencyId ?? entry.actor?.agencyId ?? null,
      groupId: entry.groupId ?? null,
      before: snap(entry.before),
      after: snap(entry.after),
      ip,
    },
  });
}

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";

const snap = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v));

export async function audit(e: {
  actor: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  agencyId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: e.actor?.id ?? null,
      actorEmail: e.actor?.email ?? null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      agencyId: e.agencyId ?? e.actor?.agencyId ?? null,
      before: snap(e.before),
      after: snap(e.after),
    },
  });
}

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/authz";
import { putFile } from "@/lib/storage";
import type { ActionResult } from "@/app/videos/actions";

const MAX_LOGO = 1024 * 1024;

function imageType(buf: Buffer): "png" | "jpg" | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}

export async function saveAgency(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const before = await prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } });
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  if (!name) return { ok: false, message: "Enter your agency's name." };
  const contactEmail = String(fd.get("contactEmail") || "").trim().slice(0, 120);
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) return { ok: false, message: "That contact email doesn't look right." };
  const brand = String(fd.get("brandPrimary") || "");
  const brandPrimary = /^#[0-9a-f]{6}$/i.test(brand) ? brand : before.brandPrimary;

  let logoKey = before.logoKey;
  if (fd.get("removeLogo") === "on") logoKey = null;
  const file = fd.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO) return { ok: false, message: "The logo must be 1 MB or smaller." };
    const buf = Buffer.from(await file.arrayBuffer());
    const t = imageType(buf);
    if (!t) return { ok: false, message: "The logo must be a PNG or JPG image." };
    logoKey = `agencies/${user.agencyId}/logo-${randomUUID()}.${t}`;
    await putFile(logoKey, buf, t === "png" ? "image/png" : "image/jpeg");
  }

  const after = await prisma.agency.update({ where: { id: user.agencyId }, data: { name, contactEmail: contactEmail || null, brandPrimary, logoKey } });
  await audit({ actor: user, action: "agency.update", entity: "Agency", entityId: user.agencyId, before, after });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. New videos will use these settings on the end card." };
}

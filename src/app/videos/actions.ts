"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePlan, requireUser } from "@/lib/authz";
import { putFile, getFile } from "@/lib/storage";
import { RateLimited, rateLimit } from "@/lib/rateLimit";
import { extractPdfText, isPdf, MAX_PDF_BYTES } from "@/lib/explainer/extract";
import { generateScript, GenerateError } from "@/lib/explainer/generate";
import { numberCheck, type NumberIssue } from "@/lib/explainer/numberCheck";
import { ExplainerScript, type ExplainerScript as Script } from "@/lib/explainer/schema";

export type ActionResult = { ok: boolean; message?: string };

const PLAN_TYPE: Record<string, Prisma.PlanCreateInput["type"]> = {
  PPO: "PPO",
  HMO: "HMO",
  EPO: "EPO",
  POS: "POS",
  "HDHP/HSA": "HDHP_HSA",
  Other: "Other",
};

async function readPdf(fd: FormData): Promise<{ buf: Buffer; name: string } | string> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a PDF to upload.";
  if (file.size > MAX_PDF_BYTES) return "That PDF is over 10 MB. Try a smaller file.";
  const buf = Buffer.from(await file.arrayBuffer());
  if (!isPdf(buf)) return "That file isn't a PDF.";
  return { buf, name: file.name.replace(/[^\w .()-]+/g, "_").slice(0, 120) || "document.pdf" };
}

async function saveDocument(planId: string, pdf: { buf: Buffer; name: string }, userId: string) {
  const key = `plans/${planId}/${randomUUID()}.pdf`;
  await putFile(key, pdf.buf, "application/pdf");
  try {
    const { text, pages } = await extractPdfText(pdf.buf);
    return prisma.benefitDocument.create({
      data: { planId, fileKey: key, fileName: pdf.name, fileSize: pdf.buf.length, pageCount: pages, extractedText: text || null, status: "EXTRACTED", uploadedById: userId },
    });
  } catch (e) {
    return prisma.benefitDocument.create({
      data: { planId, fileKey: key, fileName: pdf.name, fileSize: pdf.buf.length, status: "FAILED", error: String((e as Error).message).slice(0, 300), uploadedById: userId },
    });
  }
}

/** New video: upload the plan document, create the plan, extract its text. */
export async function createFromUpload(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pdf = await readPdf(fd);
  if (typeof pdf === "string") return { ok: false, message: pdf };
  const name = String(fd.get("name") || "").trim().slice(0, 80) || pdf.name.replace(/\.pdf$/i, "");
  const plan = await prisma.plan.create({ data: { agencyId: user.agencyId, name, planYear: String(fd.get("planYear") || "").slice(0, 10), createdById: user.id } });
  const doc = await saveDocument(plan.id, pdf, user.id);
  await audit({ actor: user, action: "plan.create", entity: "Plan", entityId: plan.id, after: { name, document: doc.fileName, status: doc.status } });
  redirect(`/videos/${plan.id}?uploaded=1`);
}

export async function replaceDocument(planId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { user } = await requirePlan(planId);
  const pdf = await readPdf(fd);
  if (typeof pdf === "string") return { ok: false, message: pdf };
  const doc = await saveDocument(planId, pdf, user.id);
  await audit({ actor: user, action: "document.upload", entity: "Plan", entityId: planId, after: { document: doc.fileName, status: doc.status } });
  revalidatePath(`/videos/${planId}`);
  return { ok: true, message: "New document uploaded. Generate a new script from it when you're ready." };
}

/** Read the plan document with Claude and write a new DRAFT explainer. */
export async function generateExplainer(planId: string): Promise<ActionResult> {
  const { user, plan } = await requirePlan(planId);
  const doc = await prisma.benefitDocument.findFirst({ where: { planId }, orderBy: { createdAt: "desc" } });
  if (!doc) return { ok: false, message: "Upload the plan document first." };
  try {
    await rateLimit("ai", user.id);
  } catch (e) {
    if (e instanceof RateLimited) return { ok: false, message: e.message };
    throw e;
  }

  let script: Script;
  const vision = !doc.extractedText;
  try {
    script = vision
      ? await generateScript({ kind: "pdf", pdf: await getFile(doc.fileKey), planName: plan.name })
      : await generateScript({ kind: "text", text: doc.extractedText!, planName: plan.name });
  } catch (e) {
    if (e instanceof GenerateError) return { ok: false, message: e.message };
    console.error("[generate]", e);
    return { ok: false, message: "Something went wrong writing the script. Try again." };
  }

  // Scanned PDF: there's no text to check against, so every number starts unverified.
  const issues = numberCheck(script, doc.extractedText ?? "");
  const explainer = await prisma.explainer.create({
    data: {
      planId,
      documentId: doc.id,
      script: script as unknown as Prisma.InputJsonValue,
      numberCheck: { issues, confirmed: [], vision } as unknown as Prisma.InputJsonValue,
      createdById: user.id,
    },
  });
  if (vision && !doc.usedVision) await prisma.benefitDocument.update({ where: { id: doc.id }, data: { usedVision: true } });

  // Fill in the plan's benefit fields from the document (never overwrite with blanks).
  const p = script.plan;
  const fill: Prisma.PlanUpdateInput = {};
  for (const k of ["carrier", "deductible", "deductibleFam", "oop", "oopFam", "coinsurance", "pcp", "specialist", "urgent", "er", "rx"] as const)
    if (p[k]) fill[k] = p[k];
  if (p.type && PLAN_TYPE[p.type]) fill.type = PLAN_TYPE[p.type];
  const after = await prisma.plan.update({ where: { id: planId }, data: fill });

  await audit({ actor: user, action: "explainer.generate", entity: "Explainer", entityId: explainer.id, after: { scenes: script.scenes.length, issues: issues.length, vision } });
  await audit({ actor: user, action: "plan.fill_from_document", entity: "Plan", entityId: planId, before: plan, after });
  revalidatePath(`/videos/${planId}`);
  return {
    ok: true,
    message: `Script ready: ${script.scenes.length} scenes.${issues.length ? ` ${issues.length} number${issues.length === 1 ? "" : "s"} need checking.` : ""}`,
  };
}

async function loadExplainer(explainerId: string) {
  const user = await requireUser();
  const ex = await prisma.explainer.findFirst({
    where: { id: explainerId, plan: { agencyId: user.agencyId } },
    include: { document: { select: { extractedText: true } } },
  });
  if (!ex) throw new Error("Not found");
  return { user, ex };
}

type Check = { issues: NumberIssue[]; confirmed: string[]; vision?: boolean };

/**
 * Save the broker's edits. Editing an approved or rendered explainer makes a new draft,
 * so the existing video stays available until the new one is approved and rendered.
 */
export async function saveScript(explainerId: string, raw: unknown): Promise<ActionResult & { explainerId?: string }> {
  const { user, ex } = await loadExplainer(explainerId);
  const parsed = ExplainerScript.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, message: `Can't save: ${i?.path.join(" › ")} ${i?.message}` };
  }
  const old = (ex.numberCheck as Check | null) ?? { issues: [], confirmed: [] };
  const issues = numberCheck(parsed.data, ex.document?.extractedText ?? "");
  const confirmed = old.confirmed.filter((k) => issues.some((i) => i.key === k));
  const data = {
    script: parsed.data as unknown as Prisma.InputJsonValue,
    numberCheck: { issues, confirmed, vision: old.vision } as unknown as Prisma.InputJsonValue,
  };
  let id = ex.id;
  if (ex.status === "DRAFT") {
    await prisma.explainer.update({ where: { id: ex.id }, data });
  } else {
    id = (await prisma.explainer.create({ data: { ...data, planId: ex.planId, documentId: ex.documentId, createdById: user.id } })).id;
  }
  await audit({ actor: user, action: "explainer.edit", entity: "Explainer", entityId: id, before: ex.script, after: parsed.data });
  revalidatePath(`/videos/${ex.planId}`);
  return { ok: true, explainerId: id, message: ex.status === "DRAFT" ? "Saved." : "Saved as a new draft. The current video stays live until you approve and render this one." };
}

/** Broker confirms (or un-confirms) a number the check couldn't find in the document. */
export async function setNumberConfirmed(explainerId: string, key: string, confirmed: boolean): Promise<ActionResult> {
  const { user, ex } = await loadExplainer(explainerId);
  if (ex.status !== "DRAFT") return { ok: false, message: "Only drafts can be changed." };
  const c = (ex.numberCheck as Check | null) ?? { issues: [], confirmed: [] };
  if (!c.issues.some((i) => i.key === key)) return { ok: false, message: "That number isn't flagged." };
  const next = confirmed ? [...new Set([...c.confirmed, key])] : c.confirmed.filter((k) => k !== key);
  await prisma.explainer.update({ where: { id: ex.id }, data: { numberCheck: { ...c, confirmed: next } as unknown as Prisma.InputJsonValue } });
  await audit({ actor: user, action: confirmed ? "explainer.confirm_number" : "explainer.unconfirm_number", entity: "Explainer", entityId: ex.id, after: { key } });
  revalidatePath(`/videos/${ex.planId}`);
  return { ok: true };
}

/** Approve the script (blocked until every flagged number is fixed or confirmed), then queue the MP4 render. */
export async function approveAndRender(explainerId: string): Promise<ActionResult> {
  const { user, ex } = await loadExplainer(explainerId);
  if (ex.status !== "DRAFT") return { ok: false, message: "This script is already approved." };
  const c = (ex.numberCheck as Check | null) ?? { issues: [], confirmed: [] };
  const open = c.issues.filter((i) => !c.confirmed.includes(i.key));
  if (open.length) return { ok: false, message: `Check ${open.length} flagged number${open.length === 1 ? "" : "s"} before approving.` };
  try {
    await rateLimit("tts", user.id);
  } catch (e) {
    if (e instanceof RateLimited) return { ok: false, message: e.message };
    throw e;
  }
  await prisma.$transaction([
    prisma.explainer.update({ where: { id: ex.id }, data: { status: "RENDERING", approvedById: user.id, approvedAt: new Date(), renderError: null } }),
    prisma.job.create({ data: { type: "explainer.render", payload: { explainerId: ex.id } } }),
  ]);
  await audit({ actor: user, action: "explainer.approve", entity: "Explainer", entityId: ex.id, after: { confirmedNumbers: c.confirmed } });
  revalidatePath(`/videos/${ex.planId}`);
  return { ok: true, message: "Approved. The video is rendering. This usually takes a few minutes." };
}

/** Re-queue a failed render (the script stays approved). */
export async function retryRender(explainerId: string): Promise<ActionResult> {
  const { user, ex } = await loadExplainer(explainerId);
  if (ex.status !== "FAILED") return { ok: false, message: "Only failed renders can be retried." };
  await prisma.$transaction([
    prisma.explainer.update({ where: { id: ex.id }, data: { status: "RENDERING", renderError: null } }),
    prisma.job.create({ data: { type: "explainer.render", payload: { explainerId: ex.id } } }),
  ]);
  await audit({ actor: user, action: "explainer.retry_render", entity: "Explainer", entityId: ex.id });
  revalidatePath(`/videos/${ex.planId}`);
  return { ok: true, message: "Rendering again." };
}

export async function renamePlan(planId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { user, plan } = await requirePlan(planId);
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const planYear = String(fd.get("planYear") || "").trim().slice(0, 10);
  if (!name) return { ok: false, message: "Enter a name." };
  const after = await prisma.plan.update({ where: { id: planId }, data: { name, planYear } });
  await audit({ actor: user, action: "plan.update", entity: "Plan", entityId: planId, before: plan, after });
  revalidatePath(`/videos/${planId}`);
  return { ok: true, message: "Saved." };
}

export async function deletePlan(planId: string): Promise<void> {
  const { user, plan } = await requirePlan(planId);
  await prisma.plan.delete({ where: { id: planId } });
  await audit({ actor: user, action: "plan.delete", entity: "Plan", entityId: planId, before: plan });
  redirect("/videos");
}

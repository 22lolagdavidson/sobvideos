/**
 * Demo data: the Davidson Solutions agency, one broker, and a "Gold PPO 1500" plan with
 * its SBC text and an approved Penny & Patch script (previewable without any API keys).
 * Run `npm run worker` afterwards to render its MP4.
 *
 *   npm run db:seed          # wipes and re-creates the demo data
 *
 * Sign in as broker@example.com (in dev the magic link lands in storage/dev-outbox/).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { ExplainerScript } from "../src/lib/explainer/schema";
import { numberCheck } from "../src/lib/explainer/numberCheck";
import { putFile } from "../src/lib/storage";
import { goldPpoScript } from "./seed-data/explainer-gold-ppo";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to wipe and seed a production database. Set ALLOW_PROD_SEED=1 to override.");
  }
  // Order matters for foreign keys.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.job.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.explainer.deleteMany(),
    prisma.benefitDocument.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.agency.deleteMany(),
  ]);

  const agency = await prisma.agency.create({ data: { name: "Davidson Solutions", contactEmail: "broker@example.com" } });
  const broker = await prisma.user.create({ data: { email: "broker@example.com", name: "Demo Broker", agencyId: agency.id } });

  const script = ExplainerScript.parse(goldPpoScript);
  const p = script.plan;
  const planYear = String(new Date().getUTCFullYear() + 1);
  const plan = await prisma.plan.create({
    data: {
      agencyId: agency.id,
      name: p.name,
      carrier: p.carrier,
      type: "PPO",
      planYear,
      deductible: p.deductible,
      deductibleFam: p.deductibleFam,
      oop: p.oop,
      oopFam: p.oopFam,
      coinsurance: p.coinsurance,
      pcp: p.pcp,
      specialist: p.specialist,
      urgent: p.urgent,
      er: p.er,
      rx: p.rx,
      createdById: broker.id,
    },
  });

  // The demo "PDF" is the SBC text; it's stored so the document link works.
  const sbcText = readFileSync(path.join(__dirname, "seed-data", "sbc-gold-ppo.txt"), "utf8");
  const fileKey = `plans/${plan.id}/demo-sbc.txt`;
  await putFile(fileKey, Buffer.from(sbcText), "text/plain");
  const doc = await prisma.benefitDocument.create({
    data: {
      planId: plan.id,
      fileKey,
      fileName: "Gold PPO 1500 SBC (demo text).pdf",
      fileSize: Buffer.byteLength(sbcText),
      pageCount: 1,
      extractedText: sbcText,
      status: "EXTRACTED",
      uploadedById: broker.id,
    },
  });

  const issues = numberCheck(script, sbcText);
  if (issues.length) throw new Error("Seed script fails the number check: " + JSON.stringify(issues));
  const explainer = await prisma.explainer.create({
    data: {
      planId: plan.id,
      documentId: doc.id,
      script: script as unknown as Prisma.InputJsonValue,
      status: "RENDERING",
      numberCheck: { issues: [], confirmed: [] },
      createdById: broker.id,
      approvedById: broker.id,
      approvedAt: new Date(),
    },
  });
  await prisma.job.create({ data: { type: "explainer.render", payload: { explainerId: explainer.id } } });

  await prisma.auditLog.create({
    data: { action: "seed.run", entity: "Agency", entityId: agency.id, agencyId: agency.id, after: { note: "Demo data seeded" } },
  });
  console.log(`Seeded ${agency.name}: plan "${plan.name}" with an approved script queued for rendering (run \`npm run worker\`).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

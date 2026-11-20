/**
 * Demo data: one agency (Davidson Solutions), one group, 2 plans, 5 employees,
 * 2 elections and one approved explainer script (previewable without an API key).
 *
 *   npm run db:seed          # wipes and re-creates the demo data
 *
 * Sign-in emails (magic links land in storage/dev-outbox/ in dev):
 *   broker@example.com   BROKER_ADMIN
 *   hr@example.com       EMPLOYER_ADMIN for the demo group
 *   any employee below   EMPLOYEE (e.g. alex.rivera@example.com)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma, type Tier } from "@prisma/client";
import { cost } from "../src/lib/domain/cost";
import { tierOf, type Dependent } from "../src/lib/domain/tier";
import { ExplainerScript } from "../src/lib/explainer/schema";
import { numberCheck } from "../src/lib/explainer/numberCheck";
import { goldPpoScript } from "./seed-data/explainer-gold-ppo";

const prisma = new PrismaClient();

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const date = (iso: string) => new Date(iso + "T00:00:00Z");

async function wipe() {
  // Order matters for FKs.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.job.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.election.deleteMany(),
    prisma.explainer.deleteMany(),
    prisma.sbcDocument.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employerGroup.deleteMany(),
    prisma.agency.deleteMany(),
  ]);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to wipe and seed a production database. Set ALLOW_PROD_SEED=1 to override.");
  }
  await wipe();

  const agency = await prisma.agency.create({
    data: {
      name: "Davidson Solutions",
      contactName: "Benefits Team",
      contactEmail: "broker@example.com",
      brandPrimary: "#2b59c3",
      brandAccent: "#ff8a3d",
    },
  });

  const broker = await prisma.user.create({
    data: { email: "broker@example.com", name: "Demo Broker", role: "BROKER_ADMIN", agencyId: agency.id },
  });

  const planYear = new Date().getUTCFullYear() + 1;
  const group = await prisma.employerGroup.create({
    data: {
      agencyId: agency.id,
      name: "Maple Street Bakery",
      planYear,
      effectiveDate: date(`${planYear}-01-01`),
      windowStart: day(-7), // open now, so the wizard works out of the box
      windowEnd: day(21),
      payPeriods: 26,
      eePct: 75,
      depPct: 25,
      participationTarget: 70,
    },
  });

  await prisma.user.create({
    data: { email: "hr@example.com", name: "Demo HR Admin", role: "EMPLOYER_ADMIN", agencyId: agency.id, groupId: group.id },
  });

  const gold = await prisma.plan.create({
    data: {
      groupId: group.id,
      sortOrder: 0,
      name: "Gold PPO 1500",
      carrier: "Bluebird Health",
      type: "PPO",
      deductible: "$1,500 individual",
      deductibleFam: "$3,000 family",
      oop: "$6,000 individual",
      oopFam: "$12,000 family",
      coinsurance: "20% after deductible",
      pcp: "$25 copay",
      specialist: "$50 copay",
      urgent: "$50 copay",
      er: "$250 copay",
      rx: "$10 generic",
      rateEe: 612.4,
      rateEs: 1286.04,
      rateEc: 1102.32,
      rateFam: 1776.0,
    },
  });

  const silver = await prisma.plan.create({
    data: {
      groupId: group.id,
      sortOrder: 1,
      name: "Silver HSA 3400",
      carrier: "Bluebird Health",
      type: "HDHP_HSA",
      deductible: "$3,400 individual",
      deductibleFam: "$6,800 family",
      oop: "$7,000 individual",
      oopFam: "$14,000 family",
      coinsurance: "30% after deductible",
      pcp: "30% after deductible",
      specialist: "30% after deductible",
      urgent: "30% after deductible",
      er: "30% after deductible",
      rx: "30% after deductible",
      rateEe: 448.15,
      rateEs: 941.12,
      rateEc: 806.67,
      rateFam: 1299.64,
    },
  });

  // Approved explainer for the Gold PPO, with the SBC text it came from.
  const sbcText = readFileSync(path.join(__dirname, "seed-data", "sbc-gold-ppo.txt"), "utf8");
  const sbc = await prisma.sbcDocument.create({
    data: {
      planId: gold.id,
      fileKey: "seed/sbc-gold-ppo.txt",
      fileName: "Gold PPO 1500 SBC (demo).pdf",
      fileSize: Buffer.byteLength(sbcText),
      pageCount: 1,
      extractedText: sbcText,
      status: "EXTRACTED",
      uploadedById: broker.id,
    },
  });
  const script = ExplainerScript.parse(goldPpoScript);
  const issues = numberCheck(script, sbcText);
  if (issues.length) throw new Error("Seed script fails the number check: " + JSON.stringify(issues));
  await prisma.explainer.create({
    data: {
      planId: gold.id,
      sbcDocumentId: sbc.id,
      script: script as unknown as Prisma.InputJsonValue,
      status: "APPROVED",
      numberCheck: { issues: [], confirmed: [] },
      createdById: broker.id,
      approvedById: broker.id,
      approvedAt: new Date(),
    },
  });

  const roster = [
    { name: "Alex Rivera", email: "alex.rivera@example.com", hireDate: "2021-03-15" },
    { name: "Jordan Lee", email: "jordan.lee@example.com", hireDate: "2019-08-01" },
    { name: "Sam Patel", email: "sam.patel@example.com", hireDate: "2023-01-09" },
    { name: "Casey Nguyen", email: "casey.nguyen@example.com", hireDate: "2022-06-20" },
    { name: "Morgan Brooks", email: "morgan.brooks@example.com", hireDate: "2024-10-01" },
  ];
  const employees = [];
  for (const r of roster) {
    employees.push(
      await prisma.employee.create({
        data: { groupId: group.id, name: r.name, email: r.email, hireDate: date(r.hireDate), eligible: true },
      }),
    );
  }

  const contribution = { eePct: 75, depPct: 25, payPeriods: 26 };
  const rates = (p: typeof gold) => ({
    ee: Number(p.rateEe),
    es: Number(p.rateEs),
    ec: Number(p.rateEc),
    fam: Number(p.rateFam),
  });

  // 1) Jordan enrolls in the Gold PPO with a spouse and a child (family tier).
  const deps: Dependent[] = [
    { name: "Taylor Lee", relationship: "Spouse", dob: "1988-04-12" },
    { name: "Riley Lee", relationship: "Child", dob: "2016-09-30" },
  ];
  const tier: Tier = tierOf(deps);
  const c = cost(rates(gold), tier, contribution);
  const jordan = employees[1];
  await prisma.election.create({
    data: {
      employeeId: jordan.id,
      version: 1,
      planId: gold.id,
      status: "ENROLLED",
      tier,
      dependents: deps,
      tobacco: false,
      premium: c.premium,
      employerShare: c.employer,
      employeeShare: c.employee,
      perPaycheck: c.perPaycheck,
      signatureName: jordan.name,
      signedAt: day(-3),
      ip: "127.0.0.1",
      userAgent: "seed",
      source: "EMPLOYEE",
    },
  });

  // 2) Sam waives: covered by a spouse's employer plan (counts as other coverage).
  const sam = employees[2];
  await prisma.election.create({
    data: {
      employeeId: sam.id,
      version: 1,
      status: "WAIVED",
      tier: "ee",
      waiveReason: "SPOUSE_EMPLOYER_PLAN",
      signatureName: sam.name,
      signedAt: day(-2),
      ip: "127.0.0.1",
      userAgent: "seed",
      source: "EMPLOYEE",
    },
  });

  await prisma.auditLog.create({
    data: { action: "seed.run", entity: "Agency", entityId: agency.id, agencyId: agency.id, after: { note: "Demo data seeded" } },
  });

  console.log(
    `Seeded ${agency.name}: group "${group.name}" (plan year ${planYear}), plans "${gold.name}" + "${silver.name}", ` +
      `${employees.length} employees, 2 elections, 1 approved explainer.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

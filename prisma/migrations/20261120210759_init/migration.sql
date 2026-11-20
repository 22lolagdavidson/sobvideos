-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BROKER_ADMIN', 'EMPLOYER_ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('PPO', 'HMO', 'EPO', 'POS', 'HDHP_HSA', 'Other');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('ee', 'es', 'ec', 'fam');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('ENROLLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ElectionSource" AS ENUM ('EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "WaiveReason" AS ENUM ('SPOUSE_EMPLOYER_PLAN', 'OTHER_EMPLOYER_PLAN', 'MEDICARE', 'MEDICAID_CHIP', 'TRICARE_VA', 'MARKETPLACE', 'OTHER');

-- CreateEnum
CREATE TYPE "SbcStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExplainerStatus" AS ENUM ('DRAFT', 'APPROVED', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "agencyId" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "logoKey" TEXT,
    "brandPrimary" TEXT NOT NULL DEFAULT '#2b59c3',
    "brandAccent" TEXT NOT NULL DEFAULT '#ff8a3d',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerGroup" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "payPeriods" INTEGER NOT NULL DEFAULT 26,
    "eePct" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "depPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "participationTarget" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT '',
    "type" "PlanType" NOT NULL DEFAULT 'PPO',
    "deductible" TEXT NOT NULL DEFAULT '',
    "deductibleFam" TEXT NOT NULL DEFAULT '',
    "oop" TEXT NOT NULL DEFAULT '',
    "oopFam" TEXT NOT NULL DEFAULT '',
    "coinsurance" TEXT NOT NULL DEFAULT '',
    "pcp" TEXT NOT NULL DEFAULT '',
    "specialist" TEXT NOT NULL DEFAULT '',
    "urgent" TEXT NOT NULL DEFAULT '',
    "er" TEXT NOT NULL DEFAULT '',
    "rx" TEXT NOT NULL DEFAULT '',
    "rateEe" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rateEs" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rateEc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rateFam" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SbcDocument" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "extractedText" TEXT,
    "usedVision" BOOLEAN NOT NULL DEFAULT false,
    "status" "SbcStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SbcDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Explainer" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sbcDocumentId" TEXT,
    "script" JSONB NOT NULL,
    "status" "ExplainerStatus" NOT NULL DEFAULT 'DRAFT',
    "numberCheck" JSONB,
    "audioKeys" JSONB,
    "captionsKey" TEXT,
    "mp4Key" TEXT,
    "durationSec" DOUBLE PRECISION,
    "renderError" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Explainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hireDate" DATE,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "planId" TEXT,
    "status" "ElectionStatus" NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'ee',
    "dependents" JSONB NOT NULL DEFAULT '[]',
    "tobacco" BOOLEAN NOT NULL DEFAULT false,
    "waiveReason" "WaiveReason",
    "premium" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "employerShare" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "employeeShare" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "perPaycheck" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "signatureName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "source" "ElectionSource" NOT NULL DEFAULT 'EMPLOYEE',
    "enteredById" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "agencyId" TEXT,
    "groupId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- CreateIndex
CREATE INDEX "User_groupId_idx" ON "User"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "EmployerGroup_agencyId_idx" ON "EmployerGroup"("agencyId");

-- CreateIndex
CREATE INDEX "Plan_groupId_idx" ON "Plan"("groupId");

-- CreateIndex
CREATE INDEX "SbcDocument_planId_idx" ON "SbcDocument"("planId");

-- CreateIndex
CREATE INDEX "Explainer_planId_status_idx" ON "Explainer"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_groupId_idx" ON "Employee"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_groupId_email_key" ON "Employee"("groupId", "email");

-- CreateIndex
CREATE INDEX "Election_planId_idx" ON "Election"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Election_employeeId_version_key" ON "Election"("employeeId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_groupId_createdAt_idx" ON "AuditLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EmployerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerGroup" ADD CONSTRAINT "EmployerGroup_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EmployerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbcDocument" ADD CONSTRAINT "SbcDocument_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explainer" ADD CONSTRAINT "Explainer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explainer" ADD CONSTRAINT "Explainer_sbcDocumentId_fkey" FOREIGN KEY ("sbcDocumentId") REFERENCES "SbcDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EmployerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

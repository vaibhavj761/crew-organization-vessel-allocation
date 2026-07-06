-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER', 'BOSS_VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED_NEEDS_PASSWORD', 'ACTIVE', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PasswordTokenType" AS ENUM ('SET_PASSWORD', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "WorkflowRole" AS ENUM ('CREW_DIRECTOR', 'OPERATIONS_MANAGER', 'CREW_MANAGER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "VesselStatus" AS ENUM ('IN_MANAGEMENT', 'UPCOMING', 'OUT_OF_MANAGEMENT');

-- CreateEnum
CREATE TYPE "ManagementType" AS ENUM ('FULL_MANAGED', 'CREW_MANAGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "department" TEXT,
    "accessRequestMessage" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "PasswordTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "workflowRole" "WorkflowRole" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsManager" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationsManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewManager" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operationsManagerId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "crewManagerId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vesselType" TEXT,
    "vesselDoc" TEXT,
    "deadweightTonnage" TEXT,
    "ownerPool" TEXT,
    "ownerName" TEXT,
    "marineSuperintendent" TEXT,
    "vesselManager" TEXT,
    "takeoverDate" TIMESTAMP(3),
    "handoverDate" TIMESTAMP(3),
    "vesselStatus" "VesselStatus" NOT NULL,
    "managementType" "ManagementType" NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VesselAllocation" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "crewManagerId" TEXT NOT NULL,
    "assignedAssistantId" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PasswordToken_userId_type_idx" ON "PasswordToken"("userId", "type");

-- CreateIndex
CREATE INDEX "PasswordToken_tokenHash_idx" ON "PasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Person_organizationId_workflowRole_idx" ON "Person"("organizationId", "workflowRole");

-- CreateIndex
CREATE UNIQUE INDEX "OperationsManager_personId_key" ON "OperationsManager"("personId");

-- CreateIndex
CREATE INDEX "OperationsManager_organizationId_sortOrder_idx" ON "OperationsManager"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CrewManager_personId_key" ON "CrewManager"("personId");

-- CreateIndex
CREATE INDEX "CrewManager_organizationId_operationsManagerId_sortOrder_idx" ON "CrewManager"("organizationId", "operationsManagerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_personId_key" ON "Assistant"("personId");

-- CreateIndex
CREATE INDEX "Assistant_organizationId_crewManagerId_sortOrder_idx" ON "Assistant"("organizationId", "crewManagerId", "sortOrder");

-- CreateIndex
CREATE INDEX "Vessel_organizationId_sortOrder_idx" ON "Vessel"("organizationId", "sortOrder");

-- CreateIndex
CREATE INDEX "Vessel_organizationId_vesselStatus_managementType_idx" ON "Vessel"("organizationId", "vesselStatus", "managementType");

-- CreateIndex
CREATE UNIQUE INDEX "VesselAllocation_vesselId_key" ON "VesselAllocation"("vesselId");

-- CreateIndex
CREATE INDEX "VesselAllocation_crewManagerId_idx" ON "VesselAllocation"("crewManagerId");

-- AddForeignKey
ALTER TABLE "PasswordToken" ADD CONSTRAINT "PasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsManager" ADD CONSTRAINT "OperationsManager_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsManager" ADD CONSTRAINT "OperationsManager_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewManager" ADD CONSTRAINT "CrewManager_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewManager" ADD CONSTRAINT "CrewManager_operationsManagerId_fkey" FOREIGN KEY ("operationsManagerId") REFERENCES "OperationsManager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewManager" ADD CONSTRAINT "CrewManager_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_crewManagerId_fkey" FOREIGN KEY ("crewManagerId") REFERENCES "CrewManager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselAllocation" ADD CONSTRAINT "VesselAllocation_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselAllocation" ADD CONSTRAINT "VesselAllocation_crewManagerId_fkey" FOREIGN KEY ("crewManagerId") REFERENCES "CrewManager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselAllocation" ADD CONSTRAINT "VesselAllocation_assignedAssistantId_fkey" FOREIGN KEY ("assignedAssistantId") REFERENCES "Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Additive migration: existing hierarchy and vessel allocation records remain unchanged.
ALTER TYPE "WorkflowRole" ADD VALUE IF NOT EXISTS 'HIERARCHY_MANAGER';

CREATE TABLE "ManagementHierarchyLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagementHierarchyLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagementHierarchyPosition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "crewDirectorId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "parentPositionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagementHierarchyPosition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationsManagerReportingLine"
ADD COLUMN "managementHierarchyPositionId" TEXT;

CREATE UNIQUE INDEX "ManagementHierarchyLevel_organizationId_name_key"
ON "ManagementHierarchyLevel"("organizationId", "name");
CREATE INDEX "ManagementHierarchyLevel_organizationId_sortOrder_idx"
ON "ManagementHierarchyLevel"("organizationId", "sortOrder");
CREATE UNIQUE INDEX "ManagementHierarchyPosition_personId_key"
ON "ManagementHierarchyPosition"("personId");
CREATE INDEX "ManagementHierarchyPosition_organizationId_crewDirectorId_parentPositionId_sortOrder_idx"
ON "ManagementHierarchyPosition"("organizationId", "crewDirectorId", "parentPositionId", "sortOrder");
CREATE INDEX "ManagementHierarchyPosition_levelId_idx"
ON "ManagementHierarchyPosition"("levelId");
CREATE INDEX "OperationsManagerReportingLine_managementHierarchyPositionId_idx"
ON "OperationsManagerReportingLine"("managementHierarchyPositionId");

ALTER TABLE "ManagementHierarchyLevel"
ADD CONSTRAINT "ManagementHierarchyLevel_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagementHierarchyPosition"
ADD CONSTRAINT "ManagementHierarchyPosition_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagementHierarchyPosition"
ADD CONSTRAINT "ManagementHierarchyPosition_crewDirectorId_fkey"
FOREIGN KEY ("crewDirectorId") REFERENCES "CrewDirector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagementHierarchyPosition"
ADD CONSTRAINT "ManagementHierarchyPosition_levelId_fkey"
FOREIGN KEY ("levelId") REFERENCES "ManagementHierarchyLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagementHierarchyPosition"
ADD CONSTRAINT "ManagementHierarchyPosition_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagementHierarchyPosition"
ADD CONSTRAINT "ManagementHierarchyPosition_parentPositionId_fkey"
FOREIGN KEY ("parentPositionId") REFERENCES "ManagementHierarchyPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationsManagerReportingLine"
ADD CONSTRAINT "OperationsManagerReportingLine_managementHierarchyPositionId_fkey"
FOREIGN KEY ("managementHierarchyPositionId") REFERENCES "ManagementHierarchyPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reset operational hierarchy data for the new Crew Director -> Operations Manager
-- -> Deputy Manager -> Crew Manager -> Vessel structure. User/auth data is not touched.
DELETE FROM "VesselAllocation";
DELETE FROM "Assistant";
DELETE FROM "Vessel";
DELETE FROM "CrewManager";
DELETE FROM "OperationsManager";
DELETE FROM "CrewDirector";
DELETE FROM "Person";
DELETE FROM "Organization";

ALTER TYPE "WorkflowRole" ADD VALUE IF NOT EXISTS 'DEPUTY_MANAGER';

CREATE TABLE "DeputyManager" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operationsManagerId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeputyManager_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeputyManager_personId_key" ON "DeputyManager"("personId");
CREATE INDEX "DeputyManager_organizationId_operationsManagerId_sortOrder_idx" ON "DeputyManager"("organizationId", "operationsManagerId", "sortOrder");

ALTER TABLE "DeputyManager" ADD CONSTRAINT "DeputyManager_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeputyManager" ADD CONSTRAINT "DeputyManager_operationsManagerId_fkey" FOREIGN KEY ("operationsManagerId") REFERENCES "OperationsManager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeputyManager" ADD CONSTRAINT "DeputyManager_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrewManager" DROP CONSTRAINT IF EXISTS "CrewManager_operationsManagerId_fkey";
DROP INDEX IF EXISTS "CrewManager_organizationId_operationsManagerId_sortOrder_idx";
ALTER TABLE "CrewManager" DROP COLUMN IF EXISTS "operationsManagerId";
ALTER TABLE "CrewManager" ADD COLUMN "deputyManagerId" TEXT NOT NULL;
CREATE INDEX "CrewManager_organizationId_deputyManagerId_sortOrder_idx" ON "CrewManager"("organizationId", "deputyManagerId", "sortOrder");
ALTER TABLE "CrewManager" ADD CONSTRAINT "CrewManager_deputyManagerId_fkey" FOREIGN KEY ("deputyManagerId") REFERENCES "DeputyManager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Organization" ("id", "name", "title", "effectiveDate", "footerText", "createdAt", "updatedAt")
VALUES (
  'org_cm_asia',
  'CM Asia',
  'Crew Operations Organization Chart',
  CURRENT_TIMESTAMP,
  'Internal management presentation',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "Person" ("id", "organizationId", "name", "designation", "workflowRole", "email", "phone", "notes", "createdAt", "updatedAt")
VALUES (
  'person_amit_kumar',
  'org_cm_asia',
  'Amit Kumar',
  'Crew Director, Asia',
  'CREW_DIRECTOR',
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "CrewDirector" ("id", "organizationId", "personId", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'crew_director_amit_kumar',
  'org_cm_asia',
  'person_amit_kumar',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

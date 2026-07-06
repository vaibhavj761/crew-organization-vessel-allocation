CREATE TABLE "CrewDirector" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrewDirector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrewDirector_personId_key" ON "CrewDirector"("personId");
CREATE INDEX "CrewDirector_organizationId_sortOrder_idx" ON "CrewDirector"("organizationId", "sortOrder");

ALTER TABLE "OperationsManager" ADD COLUMN "crewDirectorId" TEXT;

INSERT INTO "CrewDirector" ("id", "organizationId", "personId", "sortOrder", "createdAt", "updatedAt")
SELECT
  'crew-director-' || p."id",
  p."organizationId",
  p."id",
  ROW_NUMBER() OVER (PARTITION BY p."organizationId" ORDER BY p."createdAt") - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Person" p
WHERE p."workflowRole" = 'CREW_DIRECTOR'
ON CONFLICT ("personId") DO NOTHING;

INSERT INTO "Person" ("id", "organizationId", "name", "designation", "workflowRole", "email", "phone", "notes", "createdAt", "updatedAt")
SELECT
  'migrated-director-person-' || o."id",
  o."id",
  'Crew Director',
  'Crew Director',
  'CREW_DIRECTOR',
  NULL,
  NULL,
  'Created automatically during multi-crew-director migration',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "CrewDirector" cd WHERE cd."organizationId" = o."id"
);

INSERT INTO "CrewDirector" ("id", "organizationId", "personId", "sortOrder", "createdAt", "updatedAt")
SELECT
  'migrated-crew-director-' || o."id",
  o."id",
  'migrated-director-person-' || o."id",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "CrewDirector" cd WHERE cd."organizationId" = o."id"
);

UPDATE "OperationsManager" om
SET "crewDirectorId" = cd."id"
FROM "CrewDirector" cd
WHERE cd."organizationId" = om."organizationId"
  AND cd."sortOrder" = (
    SELECT MIN(cd2."sortOrder")
    FROM "CrewDirector" cd2
    WHERE cd2."organizationId" = om."organizationId"
  )
  AND om."crewDirectorId" IS NULL;

ALTER TABLE "OperationsManager" ALTER COLUMN "crewDirectorId" SET NOT NULL;

ALTER TABLE "CrewDirector"
  ADD CONSTRAINT "CrewDirector_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrewDirector"
  ADD CONSTRAINT "CrewDirector_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationsManager"
  ADD CONSTRAINT "OperationsManager_crewDirectorId_fkey"
  FOREIGN KEY ("crewDirectorId") REFERENCES "CrewDirector"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "OperationsManager_organizationId_sortOrder_idx";
CREATE INDEX "OperationsManager_organizationId_crewDirectorId_sortOrder_idx" ON "OperationsManager"("organizationId", "crewDirectorId", "sortOrder");

CREATE TABLE "OperationsManagerReportingLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "operationsManagerId" TEXT NOT NULL,
  "crewDirectorId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationsManagerReportingLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeputyManagerReportingLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deputyManagerId" TEXT NOT NULL,
  "operationsManagerId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeputyManagerReportingLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrewManagerReportingLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "crewManagerId" TEXT NOT NULL,
  "deputyManagerId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrewManagerReportingLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationsManagerReportingLine_operationsManagerId_crewDirectorId_key"
  ON "OperationsManagerReportingLine"("operationsManagerId", "crewDirectorId");
CREATE INDEX "OperationsManagerReportingLine_organizationId_crewDirectorId_idx"
  ON "OperationsManagerReportingLine"("organizationId", "crewDirectorId");
CREATE UNIQUE INDEX "DeputyManagerReportingLine_deputyManagerId_operationsManagerId_key"
  ON "DeputyManagerReportingLine"("deputyManagerId", "operationsManagerId");
CREATE INDEX "DeputyManagerReportingLine_organizationId_operationsManagerId_idx"
  ON "DeputyManagerReportingLine"("organizationId", "operationsManagerId");
CREATE UNIQUE INDEX "CrewManagerReportingLine_crewManagerId_deputyManagerId_key"
  ON "CrewManagerReportingLine"("crewManagerId", "deputyManagerId");
CREATE INDEX "CrewManagerReportingLine_organizationId_deputyManagerId_idx"
  ON "CrewManagerReportingLine"("organizationId", "deputyManagerId");

ALTER TABLE "OperationsManagerReportingLine"
  ADD CONSTRAINT "OperationsManagerReportingLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationsManagerReportingLine"
  ADD CONSTRAINT "OperationsManagerReportingLine_operationsManagerId_fkey"
  FOREIGN KEY ("operationsManagerId") REFERENCES "OperationsManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationsManagerReportingLine"
  ADD CONSTRAINT "OperationsManagerReportingLine_crewDirectorId_fkey"
  FOREIGN KEY ("crewDirectorId") REFERENCES "CrewDirector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeputyManagerReportingLine"
  ADD CONSTRAINT "DeputyManagerReportingLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeputyManagerReportingLine"
  ADD CONSTRAINT "DeputyManagerReportingLine_deputyManagerId_fkey"
  FOREIGN KEY ("deputyManagerId") REFERENCES "DeputyManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeputyManagerReportingLine"
  ADD CONSTRAINT "DeputyManagerReportingLine_operationsManagerId_fkey"
  FOREIGN KEY ("operationsManagerId") REFERENCES "OperationsManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrewManagerReportingLine"
  ADD CONSTRAINT "CrewManagerReportingLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrewManagerReportingLine"
  ADD CONSTRAINT "CrewManagerReportingLine_crewManagerId_fkey"
  FOREIGN KEY ("crewManagerId") REFERENCES "CrewManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrewManagerReportingLine"
  ADD CONSTRAINT "CrewManagerReportingLine_deputyManagerId_fkey"
  FOREIGN KEY ("deputyManagerId") REFERENCES "DeputyManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OperationsManagerReportingLine"
  ("id", "organizationId", "operationsManagerId", "crewDirectorId", "isPrimary", "updatedAt")
SELECT
  'omrl_' || "id", "organizationId", "id", "crewDirectorId", true, CURRENT_TIMESTAMP
FROM "OperationsManager";

INSERT INTO "DeputyManagerReportingLine"
  ("id", "organizationId", "deputyManagerId", "operationsManagerId", "isPrimary", "updatedAt")
SELECT
  'dmrl_' || "id", "organizationId", "id", "operationsManagerId", true, CURRENT_TIMESTAMP
FROM "DeputyManager";

INSERT INTO "CrewManagerReportingLine"
  ("id", "organizationId", "crewManagerId", "deputyManagerId", "isPrimary", "updatedAt")
SELECT
  'cmrl_' || "id", "organizationId", "id", "deputyManagerId", true, CURRENT_TIMESTAMP
FROM "CrewManager";

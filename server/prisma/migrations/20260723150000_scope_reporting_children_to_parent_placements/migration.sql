-- Scope every child reporting relationship to the exact parent placement.
-- Existing rows are attached to the primary parent placement, preserving the
-- currently authoritative hierarchy without duplicating or deleting business data.

ALTER TABLE "DeputyManagerReportingLine"
ADD COLUMN "operationsManagerReportingLineId" TEXT;

UPDATE "DeputyManagerReportingLine" AS deputy_line
SET "operationsManagerReportingLineId" = (
  SELECT operations_line."id"
  FROM "OperationsManagerReportingLine" AS operations_line
  WHERE operations_line."operationsManagerId" = deputy_line."operationsManagerId"
    AND operations_line."organizationId" = deputy_line."organizationId"
  ORDER BY operations_line."isPrimary" DESC, operations_line."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "DeputyManagerReportingLine"
ALTER COLUMN "operationsManagerReportingLineId" SET NOT NULL;

DROP INDEX "DeputyManagerReportingLine_deputyManagerId_operationsManagerId_key";

CREATE UNIQUE INDEX "DeputyManagerReportingLine_deputyManagerId_operationsManagerReportingLineId_key"
ON "DeputyManagerReportingLine"("deputyManagerId", "operationsManagerReportingLineId");

CREATE INDEX "DeputyManagerReportingLine_operationsManagerReportingLineId_idx"
ON "DeputyManagerReportingLine"("operationsManagerReportingLineId");

ALTER TABLE "DeputyManagerReportingLine"
ADD CONSTRAINT "DeputyManagerReportingLine_operationsManagerReportingLineId_fkey"
FOREIGN KEY ("operationsManagerReportingLineId")
REFERENCES "OperationsManagerReportingLine"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrewManagerReportingLine"
ADD COLUMN "deputyManagerReportingLineId" TEXT;

UPDATE "CrewManagerReportingLine" AS crew_line
SET "deputyManagerReportingLineId" = (
  SELECT deputy_line."id"
  FROM "DeputyManagerReportingLine" AS deputy_line
  WHERE deputy_line."deputyManagerId" = crew_line."deputyManagerId"
    AND deputy_line."organizationId" = crew_line."organizationId"
  ORDER BY deputy_line."isPrimary" DESC, deputy_line."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "CrewManagerReportingLine"
ALTER COLUMN "deputyManagerReportingLineId" SET NOT NULL;

DROP INDEX "CrewManagerReportingLine_crewManagerId_deputyManagerId_key";

CREATE UNIQUE INDEX "CrewManagerReportingLine_crewManagerId_deputyManagerRep_key"
ON "CrewManagerReportingLine"("crewManagerId", "deputyManagerReportingLineId");

CREATE INDEX "CrewManagerReportingLine_deputyManagerReportingLineId_idx"
ON "CrewManagerReportingLine"("deputyManagerReportingLineId");

ALTER TABLE "CrewManagerReportingLine"
ADD CONSTRAINT "CrewManagerReportingLine_deputyManagerReportingLineId_fkey"
FOREIGN KEY ("deputyManagerReportingLineId")
REFERENCES "DeputyManagerReportingLine"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

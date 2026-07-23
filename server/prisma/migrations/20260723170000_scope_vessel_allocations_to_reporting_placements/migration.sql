-- Scope each vessel allocation to one exact Crew Manager reporting placement.
-- Existing allocations are preserved and assigned to the manager's primary
-- reporting line. No Vessel or VesselAllocation rows are deleted.
ALTER TABLE "VesselAllocation"
ADD COLUMN "crewManagerReportingLineId" TEXT;

UPDATE "VesselAllocation" AS allocation
SET "crewManagerReportingLineId" = (
  SELECT reporting_line."id"
  FROM "CrewManagerReportingLine" AS reporting_line
  WHERE reporting_line."crewManagerId" = allocation."crewManagerId"
  ORDER BY reporting_line."isPrimary" DESC, reporting_line."createdAt" ASC
  LIMIT 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "VesselAllocation"
    WHERE "crewManagerReportingLineId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot scope vessel allocations: a Crew Manager reporting line is missing';
  END IF;
END $$;

ALTER TABLE "VesselAllocation"
ALTER COLUMN "crewManagerReportingLineId" SET NOT NULL;

CREATE INDEX "VesselAllocation_crewManagerReportingLineId_idx"
ON "VesselAllocation"("crewManagerReportingLineId");

ALTER TABLE "VesselAllocation"
ADD CONSTRAINT "VesselAllocation_crewManagerReportingLineId_fkey"
FOREIGN KEY ("crewManagerReportingLineId")
REFERENCES "CrewManagerReportingLine"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

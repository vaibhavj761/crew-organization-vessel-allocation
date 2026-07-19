-- Preserve every legacy Boss Viewer account as a standard read-only Viewer.
UPDATE "User"
SET "role" = 'VIEWER'
WHERE "role" = 'BOSS_VIEWER';

-- PostgreSQL enum values cannot be removed in place, so rebuild the enum
-- after all legacy values have been normalized.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "Role_revised" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_revised"
  USING ("role"::text::"Role_revised");
DROP TYPE "Role";
ALTER TYPE "Role_revised" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

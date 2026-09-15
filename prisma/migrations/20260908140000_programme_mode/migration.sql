-- CreateEnum
CREATE TYPE "ProgrammeMode" AS ENUM ('FIXED', 'REPEAT');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN "mode" "ProgrammeMode" NOT NULL DEFAULT 'REPEAT';
ALTER TABLE "Programme" ADD COLUMN "nextProgrammeId" INTEGER;

ALTER TABLE "Programme" ADD CONSTRAINT "Programme_nextProgrammeId_fkey"
  FOREIGN KEY ("nextProgrammeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "MemberProgramme" ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "MemberProgramme" ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "MemberProgramme_memberId_status_idx" ON "MemberProgramme"("memberId", "status");

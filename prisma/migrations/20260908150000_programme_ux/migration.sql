-- Gym exercise defaults used when admin adds a move to a programme
ALTER TABLE "Gym" ADD COLUMN "defaultSets" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Gym" ADD COLUMN "defaultReps" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Gym" ADD COLUMN "defaultRestSeconds" INTEGER NOT NULL DEFAULT 60;

-- Optional per-member override of programme type / auto-next
ALTER TABLE "MemberProgramme" ADD COLUMN "modeOverride" "ProgrammeMode";
ALTER TABLE "MemberProgramme" ADD COLUMN "nextProgrammeId" INTEGER;

ALTER TABLE "MemberProgramme" ADD CONSTRAINT "MemberProgramme_nextProgrammeId_fkey" FOREIGN KEY ("nextProgrammeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

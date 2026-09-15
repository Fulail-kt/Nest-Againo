-- AlterTable
ALTER TABLE "Gym" ADD COLUMN "openDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "dayKey" TEXT;

UPDATE "Attendance"
SET "dayKey" = to_char("checkedInAt", 'YYYY-MM-DD')
WHERE "dayKey" IS NULL;

DELETE FROM "Attendance" a
USING "Attendance" b
WHERE a."memberId" = b."memberId"
  AND a."dayKey" = b."dayKey"
  AND a.id < b.id;

ALTER TABLE "Attendance" ALTER COLUMN "dayKey" SET NOT NULL;

CREATE UNIQUE INDEX "Attendance_memberId_dayKey_key" ON "Attendance"("memberId", "dayKey");

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "dayKey" TEXT;

UPDATE "WorkoutSession"
SET "dayKey" = to_char(COALESCE("completedAt", "startedAt"), 'YYYY-MM-DD')
WHERE "dayKey" IS NULL;

DELETE FROM "WorkoutSet" s
USING "WorkoutSession" keep, "WorkoutSession" drop
WHERE drop."memberId" = keep."memberId"
  AND drop."dayKey" = keep."dayKey"
  AND drop.id < keep.id
  AND s."sessionId" = drop.id;

DELETE FROM "WorkoutSession" drop
USING "WorkoutSession" keep
WHERE drop."memberId" = keep."memberId"
  AND drop."dayKey" = keep."dayKey"
  AND drop.id < keep.id;

ALTER TABLE "WorkoutSession" ALTER COLUMN "dayKey" SET NOT NULL;

CREATE UNIQUE INDEX "WorkoutSession_memberId_dayKey_key" ON "WorkoutSession"("memberId", "dayKey");

-- CreateTable
CREATE TABLE "WorkoutExtraSet" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutExtraSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutExtraSet_sessionId_exerciseId_setNumber_key" ON "WorkoutExtraSet"("sessionId", "exerciseId", "setNumber");
CREATE INDEX "WorkoutExtraSet_sessionId_idx" ON "WorkoutExtraSet"("sessionId");

ALTER TABLE "WorkoutExtraSet" ADD CONSTRAINT "WorkoutExtraSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutExtraSet" ADD CONSTRAINT "WorkoutExtraSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

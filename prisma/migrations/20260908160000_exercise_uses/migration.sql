-- Per-exercise default uses (sets / reps / rest) when added to a programme
ALTER TABLE "Exercise" ADD COLUMN "defaultSets" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Exercise" ADD COLUMN "defaultReps" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Exercise" ADD COLUMN "defaultRestSeconds" INTEGER NOT NULL DEFAULT 60;

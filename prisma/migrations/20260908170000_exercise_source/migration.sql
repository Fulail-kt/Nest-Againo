ALTER TABLE "Exercise" ADD COLUMN "sourceId" TEXT;
CREATE UNIQUE INDEX "Exercise_gymId_sourceId_key" ON "Exercise"("gymId", "sourceId");

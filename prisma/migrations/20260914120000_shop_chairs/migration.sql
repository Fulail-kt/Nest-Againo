-- CreateTable
CREATE TABLE "ShopChair" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopChair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopChair_shopId_idx" ON "ShopChair"("shopId");

-- AddForeignKey
ALTER TABLE "ShopChair" ADD CONSTRAINT "ShopChair_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one chair per existing shop
INSERT INTO "ShopChair" ("shopId", "name", "sort", "updatedAt")
SELECT s."id", 'Chair 1', 0, CURRENT_TIMESTAMP
FROM "Shop" s
WHERE NOT EXISTS (
  SELECT 1 FROM "ShopChair" c WHERE c."shopId" = s."id"
);

-- AlterTable
ALTER TABLE "ShopCustomer" ADD COLUMN "preferredChairId" INTEGER;

ALTER TABLE "ShopAppointment" ADD COLUMN "chairId" INTEGER;

UPDATE "ShopAppointment" a
SET "chairId" = (
  SELECT c."id"
  FROM "ShopChair" c
  WHERE c."shopId" = a."shopId"
  ORDER BY c."sort" ASC, c."id" ASC
  LIMIT 1
)
WHERE a."chairId" IS NULL;

ALTER TABLE "ShopAppointment" ALTER COLUMN "chairId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ShopCustomer" ADD CONSTRAINT "ShopCustomer_preferredChairId_fkey" FOREIGN KEY ("preferredChairId") REFERENCES "ShopChair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopAppointment" ADD CONSTRAINT "ShopAppointment_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "ShopChair"("id") ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ShopAppointment_shopId_chairId_startAt_idx" ON "ShopAppointment"("shopId", "chairId", "startAt");

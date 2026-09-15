-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "followUpDays" INTEGER NOT NULL DEFAULT 45;

-- AlterTable
ALTER TABLE "ShopCustomer" ADD COLUMN     "followUpDueAt" TIMESTAMP(3),
ADD COLUMN     "lastMessagedAt" TIMESTAMP(3);

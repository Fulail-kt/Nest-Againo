-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SHOP_STAFF';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AlterTable
ALTER TABLE "ShopChair" ADD COLUMN "staffUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ShopChair_staffUserId_key" ON "ShopChair"("staffUserId");

-- AddForeignKey
ALTER TABLE "ShopChair" ADD CONSTRAINT "ShopChair_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

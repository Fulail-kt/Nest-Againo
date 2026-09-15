-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('APP', 'WHATSAPP', 'STAFF');

-- CreateEnum
CREATE TYPE "WaConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "WaMessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "ShopCustomer" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShopAppointment" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "BookingSource" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappIntegration" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "status" "WaConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "metaBusinessId" TEXT,
    "wabaId" TEXT,
    "phoneNumberId" TEXT,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "accessTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectTicket" TEXT,
    "ticketExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "integrationId" INTEGER NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "providerMsgId" TEXT,
    "status" "WaMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappWebhookEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopAppointment_shopId_startAt_idx" ON "ShopAppointment"("shopId", "startAt");

-- CreateIndex
CREATE INDEX "ShopAppointment_shopId_status_idx" ON "ShopAppointment"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappIntegration_shopId_key" ON "WhatsappIntegration"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappIntegration_connectTicket_key" ON "WhatsappIntegration"("connectTicket");

-- CreateIndex
CREATE INDEX "WhatsappIntegration_wabaId_idx" ON "WhatsappIntegration"("wabaId");

-- CreateIndex
CREATE INDEX "WhatsappIntegration_phoneNumberId_idx" ON "WhatsappIntegration"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_providerMsgId_key" ON "WhatsappMessage"("providerMsgId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_shopId_createdAt_idx" ON "WhatsappMessage"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShopAppointment" ADD CONSTRAINT "ShopAppointment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAppointment" ADD CONSTRAINT "ShopAppointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAppointment" ADD CONSTRAINT "ShopAppointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ShopService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappIntegration" ADD CONSTRAINT "WhatsappIntegration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "WhatsappIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

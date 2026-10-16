-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'OFFER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'OFFER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'OFFER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'OFFER_ANNOUNCED';

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'OFFER';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'OFFER';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'QUOTED';

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyBn" TEXT,
    "bodyEn" TEXT,
    "service" "ServiceId",
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageKey" TEXT,
    "imageMime" TEXT,
    "imageSize" INTEGER,
    "imageUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_isActive_startsOn_endsOn_idx" ON "Offer"("isActive", "startsOn", "endsOn");

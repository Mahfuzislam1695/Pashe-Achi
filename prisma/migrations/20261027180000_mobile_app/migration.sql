-- The Kingfisher app (Flutter, mobile/): phones that get push notifications through Firebase Cloud Messaging.
-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "userId" TEXT NOT NULL,
    "lang" "Lang" NOT NULL DEFAULT 'bn',
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Account deletion: a deleted customer keeps an emptied row, so their past bills still add up.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_DELETED';

-- The /app version of the site is gone (the native app replaced it): browsers that subscribed there
-- now open the same pages of the web version.
UPDATE "PushSubscription" SET "basePath" = '' WHERE "basePath" = '/app';

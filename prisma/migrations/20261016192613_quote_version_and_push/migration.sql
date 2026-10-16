-- CreateEnum
CREATE TYPE "PushAudience" AS ENUM ('CUSTOMER', 'ADMIN');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "quoteVersion" INTEGER NOT NULL DEFAULT 0;

-- Every quote so far was a QUOTED step in the timeline, so orders waiting for a confirm keep working.
UPDATE "Order" o SET "quoteVersion" = q.n
FROM (SELECT "orderId", count(*)::int AS n FROM "OrderStatusEvent" WHERE "to" = 'QUOTED' GROUP BY "orderId") q
WHERE q."orderId" = o.id;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "audience" "PushAudience" NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "basePath" TEXT NOT NULL DEFAULT '',
    "lang" "Lang" NOT NULL DEFAULT 'bn',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_adminId_idx" ON "PushSubscription"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_audience_key" ON "PushSubscription"("endpoint", "audience");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

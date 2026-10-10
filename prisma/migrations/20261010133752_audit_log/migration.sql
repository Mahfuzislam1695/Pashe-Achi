-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CUSTOMER_SIGNED_UP', 'CUSTOMER_PROFILE_UPDATED', 'CUSTOMER_PASSWORD_CHANGED', 'CUSTOMER_BLOCKED', 'CUSTOMER_UNBLOCKED', 'CUSTOMER_POINTS_CHANGED', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_BILL_UPDATED', 'PRICING_UPDATED', 'VEHICLE_CREATED', 'VEHICLE_UPDATED', 'SUPPORT_UPDATED', 'STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_PASSWORD_RESET', 'ADMIN_SIGNED_IN', 'ADMIN_SIGN_IN_FAILED', 'ADMIN_SIGNED_OUT', 'ADMIN_PASSWORD_CHANGED', 'ANNOUNCEMENT_SENT');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('ORDER', 'CUSTOMER', 'STAFF', 'PRICING', 'VEHICLE', 'SUPPORT', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorType" "OrderEventActor" NOT NULL,
    "adminId" TEXT,
    "userId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" "AdminRole",
    "entityType" "AuditEntity" NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the history that existed before this table, so older records don't start blank.
-- Order timelines become ORDER_CREATED / ORDER_STATUS_CHANGED rows.
INSERT INTO "AuditLog" ("id", "action", "actorType", "adminId", "userId", "actorName", "actorRole", "entityType", "entityId", "entityLabel", "changes", "note", "meta", "createdAt")
SELECT
    'bf_ev_' || e."id",
    (CASE WHEN e."from" IS NULL THEN 'ORDER_CREATED' ELSE 'ORDER_STATUS_CHANGED' END)::"AuditAction",
    e."actor",
    e."adminId",
    CASE WHEN e."actor" = 'CUSTOMER' THEN o."userId" END,
    CASE e."actor" WHEN 'CUSTOMER' THEN u."name" WHEN 'ADMIN' THEN COALESCE(a."name", 'Admin') ELSE 'System' END,
    a."role",
    'ORDER',
    o."id",
    'PA-' || o."number",
    CASE WHEN e."from" IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('field', 'status', 'from', e."from", 'to', e."to")) END,
    e."note",
    CASE WHEN e."from" IS NULL THEN jsonb_build_object('service', o."service", 'total', o."total") ELSE '{}'::jsonb END,
    e."createdAt"
FROM "OrderStatusEvent" e
JOIN "Order" o ON o."id" = e."orderId"
JOIN "User" u ON u."id" = o."userId"
LEFT JOIN "Admin" a ON a."id" = e."adminId";

-- Every existing customer signed up.
INSERT INTO "AuditLog" ("id", "action", "actorType", "userId", "actorName", "entityType", "entityId", "entityLabel", "createdAt")
SELECT 'bf_user_' || u."id", 'CUSTOMER_SIGNED_UP', 'CUSTOMER', u."id", u."name", 'CUSTOMER', u."id", u."name", u."createdAt"
FROM "User" u;

-- Every existing staff account was created (by whom is unknown, so SYSTEM).
INSERT INTO "AuditLog" ("id", "action", "actorType", "actorName", "entityType", "entityId", "entityLabel", "changes", "createdAt")
SELECT 'bf_admin_' || a."id", 'STAFF_CREATED', 'SYSTEM', 'System', 'STAFF', a."id", a."name",
       jsonb_build_array(jsonb_build_object('field', 'role', 'from', NULL, 'to', a."role")), a."createdAt"
FROM "Admin" a;

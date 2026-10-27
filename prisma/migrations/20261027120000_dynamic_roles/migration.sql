-- Roles become data: a Role table of module.action permissions (src/shared/permissions.ts), one
-- role per admin. The three fixed roles become built-in rows with the same permissions as before,
-- every admin keeps the role they had, and history entries keep the role name they were written with.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_DELETED';

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'ROLE';

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionBn" TEXT,
    "descriptionEn" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_nameEn_key" ON "Role"("nameEn");

-- The built-in roles (BUILT_IN_ROLES in src/shared/permissions.ts). Super admin is the system role:
-- it has every permission whatever its list holds.
INSERT INTO "Role" ("id", "key", "nameBn", "nameEn", "isSystem", "permissions", "updatedAt") VALUES
  ('role_super_admin', 'super_admin', 'সুপার অ্যাডমিন', 'Super admin', true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('role_manager', 'manager', 'ম্যানেজার', 'Manager', false, ARRAY[
    'dashboard.view', 'dashboard.staff_activity',
    'orders.view', 'orders.update_status', 'orders.send_price',
    'customers.view', 'customers.block', 'customers.edit_points',
    'catalog.view', 'catalog.edit',
    'offers.view', 'offers.create', 'offers.edit', 'offers.delete', 'offers.notify',
    'notifications.view', 'notifications.broadcast',
    'history.view'
  ]::TEXT[], CURRENT_TIMESTAMP),
  ('role_operator', 'operator', 'অপারেটর', 'Operator', false, ARRAY[
    'dashboard.view',
    'orders.view', 'orders.update_status', 'orders.send_price',
    'customers.view',
    'catalog.view',
    'offers.view',
    'notifications.view'
  ]::TEXT[], CURRENT_TIMESTAMP);

-- Every admin keeps their role.
ALTER TABLE "Admin" ADD COLUMN "roleId" TEXT;
UPDATE "Admin" SET "roleId" = CASE "role"
  WHEN 'SUPER_ADMIN' THEN 'role_super_admin'
  WHEN 'MANAGER' THEN 'role_manager'
  ELSE 'role_operator'
END;
ALTER TABLE "Admin" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Admin" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "Admin_roleId_idx" ON "Admin"("roleId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- History keeps the role name each entry was written with, now as { bn, en }.
ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" TYPE JSONB USING (
  CASE "actorRole"::TEXT
    WHEN 'SUPER_ADMIN' THEN '{"bn": "সুপার অ্যাডমিন", "en": "Super admin"}'::JSONB
    WHEN 'MANAGER' THEN '{"bn": "ম্যানেজার", "en": "Manager"}'::JSONB
    WHEN 'OPERATOR' THEN '{"bn": "অপারেটর", "en": "Operator"}'::JSONB
  END
);

-- DropEnum
DROP TYPE "AdminRole";

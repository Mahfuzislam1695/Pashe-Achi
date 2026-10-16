-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- Customer sessions never expire: customers who are signed in now keep their session too.
UPDATE "RefreshToken" SET "expiresAt" = NULL WHERE "userId" IS NOT NULL;

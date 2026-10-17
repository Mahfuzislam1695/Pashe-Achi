-- One map location per customer, replacing the list of saved places.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationDetails" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION;

-- Each customer keeps their default saved place as their one location.
UPDATE "User" AS u
SET "location" = s."address", "locationLat" = s."lat", "locationLng" = s."lng"
FROM "SavedLocation" AS s
WHERE s."userId" = u."id" AND s."isDefault" = true;

-- DropForeignKey
ALTER TABLE "SavedLocation" DROP CONSTRAINT "SavedLocation_userId_fkey";

-- DropTable
DROP TABLE "SavedLocation";

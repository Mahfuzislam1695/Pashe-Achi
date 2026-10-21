-- Shifting's vehicle rent is set by staff for each order, by distance, and confirmed by the customer.

-- AlterTable
ALTER TABLE "ShiftingDetail" ALTER COLUMN "vehicleRate" DROP NOT NULL;

-- Shifting orders not yet booked now wait for staff to price the vehicle: their bill is labour and floors only.
UPDATE "ShiftingDetail" AS s
SET "vehicleRate" = NULL
FROM "Order" AS o
WHERE o."id" = s."orderId" AND o."service" = 'shifting' AND o."status" = 'PENDING';

UPDATE "Order"
SET "total" = "total" - "itemsTotal", "itemsTotal" = 0
WHERE "service" = 'shifting' AND "status" = 'PENDING';

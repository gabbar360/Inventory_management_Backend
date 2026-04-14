/*
  Warnings:
  - You are about to drop the column `location_id` on the `outward_invoices` table.
  - Added the required column `location_id` to the `outward_items` table.
*/

-- Step 1: Drop location_id from outward_invoices
ALTER TABLE "outward_invoices" DROP COLUMN "location_id";

-- Step 2: Add location_id as nullable first
ALTER TABLE "outward_items" ADD COLUMN "location_id" INTEGER;

-- Step 3: Backfill from the related stock_batch
UPDATE "outward_items" oi
SET "location_id" = sb."location_id"
FROM "stock_batches" sb
WHERE oi."stock_batch_id" = sb."id";

-- Step 4: Make it NOT NULL now that all rows are populated
ALTER TABLE "outward_items" ALTER COLUMN "location_id" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE "outward_items" ADD CONSTRAINT "outward_items_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

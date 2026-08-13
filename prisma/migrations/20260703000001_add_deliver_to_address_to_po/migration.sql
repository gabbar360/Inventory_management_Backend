-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "deliver_to_address" TEXT;

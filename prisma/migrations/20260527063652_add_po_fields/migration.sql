-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "adjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "shipping_charge" DOUBLE PRECISION NOT NULL DEFAULT 0;

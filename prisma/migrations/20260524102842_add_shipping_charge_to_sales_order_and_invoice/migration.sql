-- AlterTable
ALTER TABLE "outward_invoices" ADD COLUMN     "shipping_charge" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "shipping_charge" DOUBLE PRECISION NOT NULL DEFAULT 0;

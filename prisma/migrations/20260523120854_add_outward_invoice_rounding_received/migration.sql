-- AlterTable
ALTER TABLE "outward_invoices" ADD COLUMN     "adjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "amount_received" DOUBLE PRECISION NOT NULL DEFAULT 0;

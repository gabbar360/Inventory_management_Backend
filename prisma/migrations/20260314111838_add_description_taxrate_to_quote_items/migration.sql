-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "description" TEXT,
ADD COLUMN     "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;

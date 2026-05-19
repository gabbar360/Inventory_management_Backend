-- AlterTable
ALTER TABLE "website_quotes" ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_terms" TEXT,
ADD COLUMN     "prices" TEXT,
ADD COLUMN     "shipping_charge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "terms_and_conditions" TEXT,
ADD COLUMN     "terms_of_delivery" TEXT;

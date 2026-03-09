/*
  Warnings:

  - You are about to drop the column `customer_id` on the `samples` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `samples` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `samples` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `samples` table. All the data in the column will be lost.
  - Added the required column `customer_name` to the `samples` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dispatch_method` to the `samples` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sample_type` to the `samples` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sent_by` to the `samples` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "samples" DROP CONSTRAINT "samples_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "samples" DROP CONSTRAINT "samples_product_id_fkey";

-- AlterTable
ALTER TABLE "samples" DROP COLUMN "customer_id",
DROP COLUMN "product_id",
DROP COLUMN "quantity",
DROP COLUMN "unit",
ADD COLUMN     "customer_address" TEXT,
ADD COLUMN     "customer_email" TEXT,
ADD COLUMN     "customer_name" TEXT NOT NULL,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "dispatch_method" TEXT NOT NULL,
ADD COLUMN     "kit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sample_type" TEXT NOT NULL,
ADD COLUMN     "sent_by" TEXT NOT NULL,
ADD COLUMN     "tracking_number" TEXT;

-- CreateTable
CREATE TABLE "sample_items" (
    "id" SERIAL NOT NULL,
    "sample_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "sample_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sample_items" ADD CONSTRAINT "sample_items_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_items" ADD CONSTRAINT "sample_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

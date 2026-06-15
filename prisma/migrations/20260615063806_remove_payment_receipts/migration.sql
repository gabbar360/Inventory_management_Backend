/*
  Warnings:

  - You are about to drop the `payment_receipts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "payment_receipts" DROP CONSTRAINT "payment_receipts_outward_invoice_id_fkey";

-- DropTable
DROP TABLE "payment_receipts";

/*
  Warnings:

  - You are about to drop the `profit_analysis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `profit_analysis_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "profit_analysis" DROP CONSTRAINT "profit_analysis_outward_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "profit_analysis_items" DROP CONSTRAINT "profit_analysis_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "profit_analysis_items" DROP CONSTRAINT "profit_analysis_items_profit_analysis_id_fkey";

-- DropTable
DROP TABLE "profit_analysis";

-- DropTable
DROP TABLE "profit_analysis_items";

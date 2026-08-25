/*
  Warnings:

  - You are about to drop the column `notes` on the `order_dispatches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "order_dispatches" DROP COLUMN "notes";

-- CreateIndex
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

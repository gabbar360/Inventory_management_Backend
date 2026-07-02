-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "stock_batch_id" INTEGER;

-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN     "booked_boxes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "booked_packs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "booked_pcs" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

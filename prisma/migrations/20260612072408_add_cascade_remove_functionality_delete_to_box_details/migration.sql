-- DropForeignKey
ALTER TABLE "box_details" DROP CONSTRAINT "box_details_inward_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "box_details" DROP CONSTRAINT "box_details_outward_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "box_details" DROP CONSTRAINT "box_details_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "box_details" DROP CONSTRAINT "box_details_stock_batch_id_fkey";

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_inward_invoice_id_fkey" FOREIGN KEY ("inward_invoice_id") REFERENCES "inward_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_outward_invoice_id_fkey" FOREIGN KEY ("outward_invoice_id") REFERENCES "outward_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

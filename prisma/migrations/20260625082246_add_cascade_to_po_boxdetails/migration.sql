-- DropForeignKey
ALTER TABLE "box_details" DROP CONSTRAINT "box_details_purchase_order_id_fkey";

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

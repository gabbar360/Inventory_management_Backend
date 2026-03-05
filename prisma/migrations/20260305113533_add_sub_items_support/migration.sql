-- AlterTable
ALTER TABLE "inward_items" ADD COLUMN     "parent_item_id" INTEGER;

-- AddForeignKey
ALTER TABLE "inward_items" ADD CONSTRAINT "inward_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "inward_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "batchCode" TEXT,
ADD COLUMN     "boxes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mfgDate" TIMESTAMP(3),
ADD COLUMN     "packPerBox" INTEGER NOT NULL DEFAULT 28,
ADD COLUMN     "packPerPiece" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "parent_item_id" INTEGER,
ADD COLUMN     "ratePerBox" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratePerPack" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratePerPcs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalPacks" INTEGER NOT NULL DEFAULT 28,
ADD COLUMN     "totalPcs" INTEGER NOT NULL DEFAULT 700;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

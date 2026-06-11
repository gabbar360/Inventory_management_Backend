-- AlterTable
ALTER TABLE "box_details" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "inward_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "delivery_method" TEXT,
ADD COLUMN     "expected_shipment_date" TIMESTAMP(3),
ADD COLUMN     "place_of_supply" TEXT,
ADD COLUMN     "reference" TEXT;

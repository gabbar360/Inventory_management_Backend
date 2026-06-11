-- AlterTable
ALTER TABLE "inward_items" ADD COLUMN     "batch_code" TEXT,
ADD COLUMN     "mfg_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN     "batch_code" TEXT,
ADD COLUMN     "mfg_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "box_details" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "stock_batch_id" INTEGER,
    "purchase_order_id" INTEGER,
    "inward_invoice_id" INTEGER,
    "outward_invoice_id" INTEGER,
    "box_index" INTEGER NOT NULL,
    "total_boxes" INTEGER NOT NULL,
    "pack_per_box" INTEGER NOT NULL,
    "pack_per_piece" INTEGER NOT NULL,
    "total_pcs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'expected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "box_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "box_details_barcode_key" ON "box_details"("barcode");

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_inward_invoice_id_fkey" FOREIGN KEY ("inward_invoice_id") REFERENCES "inward_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_outward_invoice_id_fkey" FOREIGN KEY ("outward_invoice_id") REFERENCES "outward_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_details" ADD CONSTRAINT "box_details_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

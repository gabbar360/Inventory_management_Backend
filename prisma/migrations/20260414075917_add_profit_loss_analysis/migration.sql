-- CreateTable
CREATE TABLE "profit_analysis" (
    "id" SERIAL NOT NULL,
    "outward_invoice_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_analysis_items" (
    "id" SERIAL NOT NULL,
    "profit_analysis_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "pack_per_box" INTEGER NOT NULL,
    "pack_per_piece" INTEGER NOT NULL,
    "order_qty" INTEGER NOT NULL,
    "dispatch_qty" INTEGER NOT NULL,
    "vendor" TEXT NOT NULL,
    "purchase_price" DOUBLE PRECISION NOT NULL,
    "sales_price" DOUBLE PRECISION NOT NULL,
    "total_purchase_cost" DOUBLE PRECISION NOT NULL,
    "total_sales_cost" DOUBLE PRECISION NOT NULL,
    "profit_loss" DOUBLE PRECISION NOT NULL,
    "profit_margin" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "profit_analysis_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profit_analysis_outward_invoice_id_key" ON "profit_analysis"("outward_invoice_id");

-- AddForeignKey
ALTER TABLE "profit_analysis" ADD CONSTRAINT "profit_analysis_outward_invoice_id_fkey" FOREIGN KEY ("outward_invoice_id") REFERENCES "outward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_analysis_items" ADD CONSTRAINT "profit_analysis_items_profit_analysis_id_fkey" FOREIGN KEY ("profit_analysis_id") REFERENCES "profit_analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_analysis_items" ADD CONSTRAINT "profit_analysis_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

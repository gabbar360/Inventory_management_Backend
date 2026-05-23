-- CreateTable
CREATE TABLE "order_dispatches" (
    "id" SERIAL NOT NULL,
    "dispatch_no" TEXT NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "dispatch_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "shipping_method" TEXT NOT NULL,
    "tracking_number" TEXT,
    "carrier" TEXT,
    "estimated_delivery" TIMESTAMP(3),
    "actual_delivery" TIMESTAMP(3),
    "shipping_address" TEXT NOT NULL,
    "shipping_city" TEXT NOT NULL,
    "shipping_state" TEXT NOT NULL,
    "shipping_pincode" TEXT NOT NULL,
    "shipping_country" TEXT NOT NULL DEFAULT 'India',
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "package_count" INTEGER NOT NULL DEFAULT 1,
    "shipping_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insurance_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_dispatches_dispatch_no_key" ON "order_dispatches"("dispatch_no");

-- CreateIndex
CREATE UNIQUE INDEX "order_dispatches_sales_order_id_key" ON "order_dispatches"("sales_order_id");

-- AddForeignKey
ALTER TABLE "order_dispatches" ADD CONSTRAINT "order_dispatches_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

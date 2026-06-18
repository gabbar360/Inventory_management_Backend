-- CreateIndex
CREATE INDEX "inward_invoices_vendor_id_idx" ON "inward_invoices"("vendor_id");

-- CreateIndex
CREATE INDEX "outward_invoices_customer_id_idx" ON "outward_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "payments_made_vendor_id_idx" ON "payments_made"("vendor_id");

-- CreateIndex
CREATE INDEX "payments_received_customer_id_idx" ON "payments_received"("customer_id");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "quotes_customer_id_idx" ON "quotes"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "stock_batches_vendor_id_idx" ON "stock_batches"("vendor_id");

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "assigned_user_id" INTEGER;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "assigned_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "purchase_orders_assigned_user_id_idx" ON "purchase_orders"("assigned_user_id");

-- CreateIndex
CREATE INDEX "sales_orders_assigned_user_id_idx" ON "sales_orders"("assigned_user_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

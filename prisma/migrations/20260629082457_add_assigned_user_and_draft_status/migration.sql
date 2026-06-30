-- AlterTable
ALTER TABLE "inward_invoices" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "outward_invoices" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "assigned_user_id" INTEGER;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "assigned_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "assigned_user_id" INTEGER;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "assigned_user_id" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_assigned_user_id_idx" ON "purchase_orders"("assigned_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_assigned_user_id_idx" ON "sales_orders"("assigned_user_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

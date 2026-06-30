/*
  Warnings:

  - You are about to drop the column `status` on the `inward_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `outward_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_user_id` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_user_id` on the `sales_orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_assigned_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sales_orders" DROP CONSTRAINT "sales_orders_assigned_user_id_fkey";

-- AlterTable
ALTER TABLE "inward_invoices" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "outward_invoices" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "assigned_user_id";

-- AlterTable
ALTER TABLE "sales_orders" DROP COLUMN "assigned_user_id";

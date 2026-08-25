/*
  Warnings:

  - You are about to drop the column `assigned_user_id` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_user_id` on the `sales_orders` table. All the data in the column will be lost.
  - You are about to drop the `pending_scans` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "pending_scans" DROP CONSTRAINT IF EXISTS "pending_scans_product_id_fkey";

-- DropForeignKey
ALTER TABLE "pending_scans" DROP CONSTRAINT IF EXISTS "pending_scans_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "pending_scans" DROP CONSTRAINT IF EXISTS "pending_scans_scanned_by_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_assigned_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "sales_orders_assigned_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "purchase_orders_assigned_user_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "sales_orders_assigned_user_id_idx";

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "assigned_user_id";

-- AlterTable
ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "assigned_user_id";

-- DropTable
DROP TABLE IF EXISTS "pending_scans";

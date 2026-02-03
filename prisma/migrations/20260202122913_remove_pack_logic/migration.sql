/*
  Warnings:

  - You are about to drop the column `pack_per_box` on the `inward_items` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `inward_items` table. All the data in the column will be lost.
  - You are about to drop the column `rate_per_unit` on the `inward_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `inward_items` table. All the data in the column will be lost.
  - You are about to drop the column `cost_per_unit` on the `stock_batches` table. All the data in the column will be lost.
  - You are about to drop the column `pack_per_box` on the `stock_batches` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `stock_batches` table. All the data in the column will be lost.
  - You are about to drop the column `remaining_quantity` on the `stock_batches` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `stock_batches` table. All the data in the column will be lost.
  - Made the column `boxes` on table `inward_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rate_per_box` on table `inward_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `boxes` on table `stock_batches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `remaining_boxes` on table `stock_batches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cost_per_box` on table `stock_batches` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "inward_items" DROP COLUMN "pack_per_box",
DROP COLUMN "quantity",
DROP COLUMN "rate_per_unit",
DROP COLUMN "unit",
ALTER COLUMN "boxes" SET NOT NULL,
ALTER COLUMN "rate_per_box" SET NOT NULL;

-- AlterTable
ALTER TABLE "stock_batches" DROP COLUMN "cost_per_unit",
DROP COLUMN "pack_per_box",
DROP COLUMN "quantity",
DROP COLUMN "remaining_quantity",
DROP COLUMN "unit",
ALTER COLUMN "boxes" SET NOT NULL,
ALTER COLUMN "remaining_boxes" SET NOT NULL,
ALTER COLUMN "cost_per_box" SET NOT NULL;

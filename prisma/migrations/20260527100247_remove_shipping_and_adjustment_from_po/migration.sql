/*
  Warnings:

  - You are about to drop the column `adjustment` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the column `shipping_charge` on the `purchase_orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "adjustment",
DROP COLUMN "shipping_charge";

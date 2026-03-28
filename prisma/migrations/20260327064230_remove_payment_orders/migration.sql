/*
  Warnings:

  - You are about to drop the `payment_orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_quote_id_fkey";

-- DropTable
DROP TABLE "payment_orders";

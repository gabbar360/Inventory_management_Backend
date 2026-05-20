/*
  Warnings:

  - A unique constraint covering the columns `[upc]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "upc" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_upc_key" ON "products"("upc");

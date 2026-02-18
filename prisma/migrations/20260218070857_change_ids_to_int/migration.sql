/*
  Warnings:

  - The primary key for the `categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `customers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `customers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `inward_invoices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `inward_invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `inward_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `inward_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `locations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `locations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `outward_invoices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `outward_invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `outward_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `outward_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `stock_batches` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `stock_batches` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `stock_movements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `stock_movements` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `vendors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `vendors` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `vendor_id` on the `inward_invoices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `location_id` on the `inward_invoices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `inward_invoice_id` on the `inward_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `inward_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customer_id` on the `outward_invoices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `location_id` on the `outward_invoices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `outward_invoice_id` on the `outward_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `outward_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `stock_batch_id` on the `outward_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category_id` on the `products` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `stock_batches` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `vendor_id` on the `stock_batches` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `location_id` on the `stock_batches` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reference_id` on the `stock_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `product_id` on the `stock_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `location_id` on the `stock_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "inward_invoices" DROP CONSTRAINT "inward_invoices_location_id_fkey";

-- DropForeignKey
ALTER TABLE "inward_invoices" DROP CONSTRAINT "inward_invoices_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "inward_items" DROP CONSTRAINT "inward_items_inward_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "inward_items" DROP CONSTRAINT "inward_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "outward_invoices" DROP CONSTRAINT "outward_invoices_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "outward_invoices" DROP CONSTRAINT "outward_invoices_location_id_fkey";

-- DropForeignKey
ALTER TABLE "outward_items" DROP CONSTRAINT "outward_items_outward_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "outward_items" DROP CONSTRAINT "outward_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "outward_items" DROP CONSTRAINT "outward_items_stock_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_batches" DROP CONSTRAINT "stock_batches_location_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_batches" DROP CONSTRAINT "stock_batches_product_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_batches" DROP CONSTRAINT "stock_batches_vendor_id_fkey";

-- AlterTable
ALTER TABLE "categories" DROP CONSTRAINT "categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "customers" DROP CONSTRAINT "customers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "inward_invoices" DROP CONSTRAINT "inward_invoices_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "vendor_id",
ADD COLUMN     "vendor_id" INTEGER NOT NULL,
DROP COLUMN "location_id",
ADD COLUMN     "location_id" INTEGER NOT NULL,
ADD CONSTRAINT "inward_invoices_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "inward_items" DROP CONSTRAINT "inward_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "inward_invoice_id",
ADD COLUMN     "inward_invoice_id" INTEGER NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" INTEGER NOT NULL,
ADD CONSTRAINT "inward_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "locations" DROP CONSTRAINT "locations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "outward_invoices" DROP CONSTRAINT "outward_invoices_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "customer_id",
ADD COLUMN     "customer_id" INTEGER NOT NULL,
DROP COLUMN "location_id",
ADD COLUMN     "location_id" INTEGER NOT NULL,
ADD CONSTRAINT "outward_invoices_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "outward_items" DROP CONSTRAINT "outward_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "outward_invoice_id",
ADD COLUMN     "outward_invoice_id" INTEGER NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" INTEGER NOT NULL,
DROP COLUMN "stock_batch_id",
ADD COLUMN     "stock_batch_id" INTEGER NOT NULL,
ADD CONSTRAINT "outward_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "products" DROP CONSTRAINT "products_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" INTEGER NOT NULL,
ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "stock_batches" DROP CONSTRAINT "stock_batches_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" INTEGER NOT NULL,
DROP COLUMN "vendor_id",
ADD COLUMN     "vendor_id" INTEGER NOT NULL,
DROP COLUMN "location_id",
ADD COLUMN     "location_id" INTEGER NOT NULL,
ADD CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "reference_id",
ADD COLUMN     "reference_id" INTEGER NOT NULL,
DROP COLUMN "product_id",
ADD COLUMN     "product_id" INTEGER NOT NULL,
DROP COLUMN "location_id",
ADD COLUMN     "location_id" INTEGER NOT NULL,
ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "vendors" DROP CONSTRAINT "vendors_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inward_invoices" ADD CONSTRAINT "inward_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inward_invoices" ADD CONSTRAINT "inward_invoices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inward_items" ADD CONSTRAINT "inward_items_inward_invoice_id_fkey" FOREIGN KEY ("inward_invoice_id") REFERENCES "inward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inward_items" ADD CONSTRAINT "inward_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outward_invoices" ADD CONSTRAINT "outward_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outward_invoices" ADD CONSTRAINT "outward_invoices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outward_items" ADD CONSTRAINT "outward_items_outward_invoice_id_fkey" FOREIGN KEY ("outward_invoice_id") REFERENCES "outward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outward_items" ADD CONSTRAINT "outward_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outward_items" ADD CONSTRAINT "outward_items_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

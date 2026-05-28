/*
  Warnings:

  - You are about to drop the column `customer_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `customer_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `customer_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `customer_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `customer_suffix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_suffix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `po_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `po_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `po_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `po_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `po_suffix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `quote_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `quote_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `quote_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `quote_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `quote_suffix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `sales_order_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `sales_order_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `sales_order_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `sales_order_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `sales_order_suffix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_current` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_middle` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_padding` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_prefix` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_suffix` on the `settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "settings" DROP COLUMN "customer_current",
DROP COLUMN "customer_middle",
DROP COLUMN "customer_padding",
DROP COLUMN "customer_prefix",
DROP COLUMN "customer_suffix",
DROP COLUMN "invoice_current",
DROP COLUMN "invoice_middle",
DROP COLUMN "invoice_padding",
DROP COLUMN "invoice_prefix",
DROP COLUMN "invoice_suffix",
DROP COLUMN "po_current",
DROP COLUMN "po_middle",
DROP COLUMN "po_padding",
DROP COLUMN "po_prefix",
DROP COLUMN "po_suffix",
DROP COLUMN "quote_current",
DROP COLUMN "quote_middle",
DROP COLUMN "quote_padding",
DROP COLUMN "quote_prefix",
DROP COLUMN "quote_suffix",
DROP COLUMN "sales_order_current",
DROP COLUMN "sales_order_middle",
DROP COLUMN "sales_order_padding",
DROP COLUMN "sales_order_prefix",
DROP COLUMN "sales_order_suffix",
DROP COLUMN "vendor_current",
DROP COLUMN "vendor_middle",
DROP COLUMN "vendor_padding",
DROP COLUMN "vendor_prefix",
DROP COLUMN "vendor_suffix";

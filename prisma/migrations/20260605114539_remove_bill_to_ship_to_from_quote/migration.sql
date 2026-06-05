/*
  Warnings:

  - You are about to drop the column `bill_to_details` on the `quotes` table. All the data in the column will be lost.
  - You are about to drop the column `ship_to_details` on the `quotes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "quotes" DROP COLUMN "bill_to_details",
DROP COLUMN "ship_to_details";

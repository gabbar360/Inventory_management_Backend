/*
  Warnings:

  - You are about to drop the column `description` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `parent_id` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `use_parent_hsn_code` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the `packaging_levels` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "packaging_levels" DROP CONSTRAINT "packaging_levels_category_id_fkey";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "description",
DROP COLUMN "parent_id",
DROP COLUMN "use_parent_hsn_code";

-- DropTable
DROP TABLE "packaging_levels";

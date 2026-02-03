/*
  Warnings:

  - You are about to drop the column `pcs_per_box` on the `inward_items` table. All the data in the column will be lost.
  - You are about to drop the column `pcs_per_box` on the `stock_batches` table. All the data in the column will be lost.
  - Added the required column `pack_per_box` to the `inward_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pack_per_piece` to the `inward_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rate_per_pack` to the `inward_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_packs` to the `inward_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_per_pack` to the `stock_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pack_per_box` to the `stock_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pack_per_piece` to the `stock_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remaining_packs` to the `stock_batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_packs` to the `stock_batches` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inward_items" DROP COLUMN "pcs_per_box",
ADD COLUMN     "pack_per_box" INTEGER NOT NULL,
ADD COLUMN     "pack_per_piece" INTEGER NOT NULL,
ADD COLUMN     "rate_per_pack" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "total_packs" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "stock_batches" DROP COLUMN "pcs_per_box",
ADD COLUMN     "cost_per_pack" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "pack_per_box" INTEGER NOT NULL,
ADD COLUMN     "pack_per_piece" INTEGER NOT NULL,
ADD COLUMN     "remaining_packs" INTEGER NOT NULL,
ADD COLUMN     "total_packs" INTEGER NOT NULL;

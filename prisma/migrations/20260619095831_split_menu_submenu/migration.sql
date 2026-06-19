/*
  Warnings:

  - You are about to drop the column `parent_id` on the `menu_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_parent_id_fkey";

-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "parent_id";

-- CreateTable
CREATE TABLE "sub_menu_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "menu_item_id" INTEGER NOT NULL,
    "permission_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_menu_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sub_menu_items" ADD CONSTRAINT "sub_menu_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_menu_items" ADD CONSTRAINT "sub_menu_items_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

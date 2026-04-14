-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "description" TEXT,
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "use_parent_hsn_code" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "packaging_levels" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "level_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "level_order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packaging_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_levels_category_id_level_order_key" ON "packaging_levels"("category_id", "level_order");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_levels" ADD CONSTRAINT "packaging_levels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" SERIAL NOT NULL,
    "transfer_no" TEXT NOT NULL,
    "stock_batch_id" INTEGER NOT NULL,
    "from_location_id" INTEGER NOT NULL,
    "to_location_id" INTEGER NOT NULL,
    "boxes" INTEGER NOT NULL,
    "packs" INTEGER NOT NULL DEFAULT 0,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transfer_no_key" ON "stock_transfers"("transfer_no");

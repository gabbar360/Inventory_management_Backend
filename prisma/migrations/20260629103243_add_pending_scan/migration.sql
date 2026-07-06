-- CreateTable
CREATE TABLE "pending_scans" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scanned_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_scans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

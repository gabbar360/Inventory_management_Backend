-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" SERIAL NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "outward_invoice_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL DEFAULT 'UPI',
    "transaction_id" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receipt_no_key" ON "payment_receipts"("receipt_no");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_outward_invoice_id_fkey" FOREIGN KEY ("outward_invoice_id") REFERENCES "outward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

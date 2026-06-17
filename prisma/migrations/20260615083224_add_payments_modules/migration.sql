-- AlterTable
ALTER TABLE "inward_invoices" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payments_received" (
    "id" SERIAL NOT NULL,
    "payment_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "reference_number" TEXT,
    "deposit_to" TEXT NOT NULL,
    "bank_charges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "transaction_type" TEXT NOT NULL DEFAULT 'invoice_payment',
    "unused_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_received_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_received_invoices" (
    "id" SERIAL NOT NULL,
    "payment_received_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "amount_applied" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "payment_received_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_made" (
    "id" SERIAL NOT NULL,
    "payment_number" TEXT NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "reference_number" TEXT,
    "paid_through" TEXT NOT NULL,
    "bank_charges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "transaction_type" TEXT NOT NULL DEFAULT 'bill_payment',
    "unused_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_made_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_made_invoices" (
    "id" SERIAL NOT NULL,
    "payment_made_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "amount_applied" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "payment_made_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_received_payment_number_key" ON "payments_received"("payment_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_received_invoices_payment_received_id_invoice_id_key" ON "payment_received_invoices"("payment_received_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_made_payment_number_key" ON "payments_made"("payment_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_made_invoices_payment_made_id_invoice_id_key" ON "payment_made_invoices"("payment_made_id", "invoice_id");

-- AddForeignKey
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_received_invoices" ADD CONSTRAINT "payment_received_invoices_payment_received_id_fkey" FOREIGN KEY ("payment_received_id") REFERENCES "payments_received"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_received_invoices" ADD CONSTRAINT "payment_received_invoices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "outward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_made_invoices" ADD CONSTRAINT "payment_made_invoices_payment_made_id_fkey" FOREIGN KEY ("payment_made_id") REFERENCES "payments_made"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_made_invoices" ADD CONSTRAINT "payment_made_invoices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "inward_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

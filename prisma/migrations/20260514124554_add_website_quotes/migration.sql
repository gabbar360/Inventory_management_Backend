-- CreateTable
CREATE TABLE "website_quotes" (
    "id" SERIAL NOT NULL,
    "quote_no" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "order_type" TEXT NOT NULL DEFAULT 'domestic',
    "gstin" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "billing_address" TEXT,
    "country" TEXT,
    "delivery_terms" TEXT,
    "port_of_discharge" TEXT,
    "address" TEXT,
    "additional_requirements" TEXT,
    "total_pieces" INTEGER NOT NULL DEFAULT 0,
    "total_weight" TEXT,
    "total_cbm" TEXT,
    "products" TEXT NOT NULL,
    "quote_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_quotes_quote_no_key" ON "website_quotes"("quote_no");

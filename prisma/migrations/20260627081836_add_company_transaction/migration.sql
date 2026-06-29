-- CreateTable
CREATE TABLE "company_transactions" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_transactions_user_id_idx" ON "company_transactions"("user_id");

-- AddForeignKey
ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

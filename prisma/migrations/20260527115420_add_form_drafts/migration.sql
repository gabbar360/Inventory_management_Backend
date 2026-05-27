-- CreateTable
CREATE TABLE "form_drafts" (
    "id" SERIAL NOT NULL,
    "form_type" TEXT NOT NULL,
    "record_id" INTEGER,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_drafts_form_type_record_id_key" ON "form_drafts"("form_type", "record_id");

-- AlterTable
ALTER TABLE "pending_scans" ADD COLUMN     "reference_id" INTEGER,
ADD COLUMN     "reference_type" TEXT;

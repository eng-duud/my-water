-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "initialReading" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "workUnits" SET DEFAULT 0;

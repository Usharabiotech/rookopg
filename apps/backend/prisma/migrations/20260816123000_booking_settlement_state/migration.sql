-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'SPLIT', 'FAILED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "refundedPaise" INTEGER,
ADD COLUMN     "releasedPaise" INTEGER,
ADD COLUMN     "settledAt" TIMESTAMPTZ(3),
ADD COLUMN     "settlementError" VARCHAR(400),
ADD COLUMN     "settlementRef" VARCHAR(300),
ADD COLUMN     "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'HELD';

-- CreateIndex
CREATE INDEX "bookings_settlementStatus_moveInDate_idx" ON "bookings"("settlementStatus", "moveInDate");


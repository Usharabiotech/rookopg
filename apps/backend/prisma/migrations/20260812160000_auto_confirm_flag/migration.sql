-- Per-property switch for whether a paid booking confirms immediately.
-- Defaults to owner approval, which is today's behaviour; the product
-- decision is still open, and this keeps the change to a default.

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "autoConfirmBookings" BOOLEAN NOT NULL DEFAULT false;

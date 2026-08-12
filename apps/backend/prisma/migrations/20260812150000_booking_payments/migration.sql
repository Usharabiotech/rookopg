-- Online booking: gateway order and checkout hold on the booking, plus
-- an append-only log of verified gateway notifications. The unique
-- gatewayEventId is what makes webhook processing idempotent.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "gatewayOrderId" VARCHAR(64),
ADD COLUMN     "holdExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "paidAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "gatewayEventId" VARCHAR(120) NOT NULL,
    "paymentId" UUID,
    "bookingId" UUID,
    "eventType" VARCHAR(80) NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "processingResult" VARCHAR(300),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_gatewayEventId_key" ON "payment_events"("gatewayEventId");

-- CreateIndex
CREATE INDEX "payment_events_paymentId_idx" ON "payment_events"("paymentId");

-- CreateIndex
CREATE INDEX "payment_events_bookingId_idx" ON "payment_events"("bookingId");

-- CreateIndex
CREATE INDEX "payment_events_processedAt_idx" ON "payment_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_gatewayOrderId_key" ON "bookings"("gatewayOrderId");

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

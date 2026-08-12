-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('RENT', 'DEPOSIT', 'ONE_OFF', 'UTILITY', 'DAMAGE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY_UPI', 'CASH', 'UPI_DIRECT', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tenancyId" UUID NOT NULL,
    "tenantUserId" UUID NOT NULL,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'RENT',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "isProRata" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(200),
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" VARCHAR(300),
    "cycleKey" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tenancyId" UUID,
    "tenantUserId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CAPTURED',
    "amountPaise" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "gatewayOrderId" VARCHAR(64),
    "gatewayPaymentId" VARCHAR(64),
    "recordedByUserId" UUID,
    "reference" VARCHAR(120),
    "note" VARCHAR(300),
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_orgId_status_dueDate_idx" ON "invoices"("orgId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_propertyId_status_dueDate_idx" ON "invoices"("propertyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_tenantUserId_status_dueDate_idx" ON "invoices"("tenantUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_dueDate_status_idx" ON "invoices"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenancyId_kind_cycleKey_key" ON "invoices"("tenancyId", "kind", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayOrderId_key" ON "payments"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payments_orgId_receivedAt_idx" ON "payments"("orgId", "receivedAt");

-- CreateIndex
CREATE INDEX "payments_propertyId_receivedAt_idx" ON "payments"("propertyId", "receivedAt");

-- CreateIndex
CREATE INDEX "payments_tenantUserId_receivedAt_idx" ON "payments"("tenantUserId", "receivedAt");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_invoiceId_key" ON "payment_allocations"("paymentId", "invoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "tenancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "tenancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

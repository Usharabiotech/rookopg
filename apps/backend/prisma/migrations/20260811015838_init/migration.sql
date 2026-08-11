-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('UNCLAIMED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPPORT', 'MODERATOR', 'FINANCE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "GenderPolicy" AS ENUM ('MEN', 'WOMEN', 'CO_LIVING');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PG', 'HOSTEL', 'CO_LIVING');

-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('VEG', 'NON_VEG', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaTag" AS ENUM ('EXTERIOR', 'ROOM', 'BATHROOM', 'KITCHEN', 'COMMON_AREA', 'DINING', 'ENTRANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SharingType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'DORMITORY');

-- CreateEnum
CREATE TYPE "RoomGender" AS ENUM ('MEN', 'WOMEN', 'ANY');

-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('PER_BED', 'WHOLE_ROOM');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AllocationKind" AS ENUM ('HOLD', 'BOOKING', 'TENANCY', 'BLOCK');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNLISTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('VISITED', 'NO_SHOW', 'NOT_INTERESTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'HELD', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'PENDING_APPROVAL', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'NOTICE_GIVEN', 'ENDED');

-- CreateEnum
CREATE TYPE "TenancyEndReason" AS ENUM ('NOTICE_COMPLETED', 'EARLY_EXIT', 'TRANSFERRED', 'EVICTED', 'ABSCONDED');

-- CreateEnum
CREATE TYPE "CheckinKind" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "CheckinMethod" AS ENUM ('QR', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(255),
    "fullName" VARCHAR(120),
    "dateOfBirth" DATE,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "legalName" VARCHAR(200),
    "status" "OrgStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "verifiedAt" TIMESTAMPTZ(3),
    "freePeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "freePeriodStartsAt" TIMESTAMPTZ(3),
    "razorpayAccountId" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membership_properties" (
    "membershipId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,

    CONSTRAINT "org_membership_properties_pkey" PRIMARY KEY ("membershipId","propertyId")
);

-- CreateTable
CREATE TABLE "platform_memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" VARCHAR(128) NOT NULL,
    "familyId" UUID NOT NULL,
    "deviceLabel" VARCHAR(120),
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "accountHolderName" VARCHAR(160) NOT NULL,
    "accountNumberEnc" TEXT NOT NULL,
    "accountNumberLast4" VARCHAR(4) NOT NULL,
    "ifsc" VARCHAR(11) NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localities" (
    "id" UUID NOT NULL,
    "city" VARCHAR(80) NOT NULL DEFAULT 'Hyderabad',
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "centroidLat" DECIMAL(10,7),
    "centroidLng" DECIMAL(10,7),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'PG',
    "genderPolicy" "GenderPolicy" NOT NULL,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "landmark" VARCHAR(160),
    "localityId" UUID NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "contactPhone" VARCHAR(16),
    "defaultRentCycleDay" SMALLINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_meal_plans" (
    "propertyId" UUID NOT NULL,
    "foodType" "FoodType" NOT NULL DEFAULT 'VEG',
    "breakfast" BOOLEAN NOT NULL DEFAULT false,
    "lunch" BOOLEAN NOT NULL DEFAULT false,
    "dinner" BOOLEAN NOT NULL DEFAULT false,
    "includedInRent" BOOLEAN NOT NULL DEFAULT true,
    "extraChargePaise" INTEGER,
    "notes" VARCHAR(500),

    CONSTRAINT "property_meal_plans_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "property_rules" (
    "propertyId" UUID NOT NULL,
    "gateClosingTime" VARCHAR(5),
    "visitorsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "alcoholAllowed" BOOLEAN NOT NULL DEFAULT false,
    "cookingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(1000),

    CONSTRAINT "property_rules_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "propertyId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable
CREATE TABLE "property_media" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "kind" "MediaKind" NOT NULL DEFAULT 'PHOTO',
    "tag" "MediaTag" NOT NULL DEFAULT 'OTHER',
    "storageKey" VARCHAR(400) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "floor" SMALLINT,
    "sharingType" "SharingType" NOT NULL,
    "sharingCapacity" SMALLINT NOT NULL,
    "saleMode" "SaleMode" NOT NULL DEFAULT 'PER_BED',
    "gender" "RoomGender" NOT NULL,
    "hasAc" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachedBath" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "baseRentPaise" INTEGER NOT NULL,
    "depositPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "rentOverridePaise" INTEGER,
    "status" "BedStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_allocations" (
    "id" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "kind" "AllocationKind" NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "bookingId" UUID,
    "tenancyId" UUID,
    "expiresAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),
    "releaseReason" VARCHAR(200),

    CONSTRAINT "bed_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "headline" VARCHAR(200),
    "description" TEXT,
    "completenessScore" SMALLINT NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "rejectionReason" VARCHAR(500),
    "availabilityConfirmedAt" TIMESTAMPTZ(3),
    "responseScore" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_misses" (
    "id" UUID NOT NULL,
    "localityId" UUID,
    "filters" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "userId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_misses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "prospectUserId" UUID NOT NULL,
    "requestedStart" TIMESTAMPTZ(3) NOT NULL,
    "requestedEnd" TIMESTAMPTZ(3) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "outcome" "VisitOutcome",
    "ownerRespondedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "tenantUserId" UUID NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'ONLINE',
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "moveInDate" DATE NOT NULL,
    "agreedRentPaise" INTEGER NOT NULL,
    "agreedDepositPaise" INTEGER NOT NULL DEFAULT 0,
    "payableNowPaise" INTEGER NOT NULL,
    "convenienceFeePaise" INTEGER NOT NULL DEFAULT 0,
    "noticeDays" INTEGER NOT NULL DEFAULT 30,
    "lockInDays" INTEGER NOT NULL DEFAULT 0,
    "termsVersion" VARCHAR(40),
    "termsAcceptedAt" TIMESTAMPTZ(3),
    "ownerRespondedAt" TIMESTAMPTZ(3),
    "approvalExpiresAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" VARCHAR(400),
    "idempotencyKey" VARCHAR(80),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorId" UUID,
    "reason" VARCHAR(400),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancies" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "tenantUserId" UUID NOT NULL,
    "bookingId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "agreedRentPaise" INTEGER NOT NULL,
    "depositPaise" INTEGER NOT NULL DEFAULT 0,
    "cycleAnchorDay" SMALLINT,
    "noticeDays" INTEGER NOT NULL DEFAULT 30,
    "lockInUntil" DATE,
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "noticeGivenAt" TIMESTAMPTZ(3),
    "intendedVacateDate" DATE,
    "actualVacateDate" DATE,
    "endReason" "TenancyEndReason",
    "previousTenancyId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancy_status_history" (
    "id" UUID NOT NULL,
    "tenancyId" UUID NOT NULL,
    "fromStatus" "TenancyStatus",
    "toStatus" "TenancyStatus" NOT NULL,
    "actorId" UUID,
    "reason" VARCHAR(400),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenancy_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_tokens" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validTo" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "usedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_events" (
    "id" UUID NOT NULL,
    "bookingId" UUID,
    "tenancyId" UUID,
    "propertyId" UUID NOT NULL,
    "kind" "CheckinKind" NOT NULL,
    "method" "CheckinMethod" NOT NULL,
    "actorId" UUID,
    "overrideReason" VARCHAR(400),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" VARCHAR(40),
    "action" VARCHAR(80) NOT NULL,
    "subjectType" VARCHAR(60) NOT NULL,
    "subjectId" UUID,
    "orgId" UUID,
    "reason" VARCHAR(400),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(300),
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organisations_razorpayAccountId_key" ON "organisations"("razorpayAccountId");

-- CreateIndex
CREATE INDEX "organisations_status_idx" ON "organisations"("status");

-- CreateIndex
CREATE INDEX "org_memberships_userId_active_idx" ON "org_memberships"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_orgId_userId_key" ON "org_memberships"("orgId", "userId");

-- CreateIndex
CREATE INDEX "org_membership_properties_propertyId_idx" ON "org_membership_properties"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_memberships_userId_role_key" ON "platform_memberships"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "auth_sessions_familyId_idx" ON "auth_sessions"("familyId");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_createdAt_idx" ON "otp_challenges"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "otp_challenges_expiresAt_idx" ON "otp_challenges"("expiresAt");

-- CreateIndex
CREATE INDEX "bank_accounts_orgId_isPrimary_idx" ON "bank_accounts"("orgId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "localities_slug_key" ON "localities"("slug");

-- CreateIndex
CREATE INDEX "localities_city_active_idx" ON "localities"("city", "active");

-- CreateIndex
CREATE INDEX "properties_orgId_deletedAt_idx" ON "properties"("orgId", "deletedAt");

-- CreateIndex
CREATE INDEX "properties_localityId_genderPolicy_deletedAt_idx" ON "properties"("localityId", "genderPolicy", "deletedAt");

-- CreateIndex
CREATE INDEX "properties_latitude_longitude_idx" ON "properties"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "properties_id_orgId_key" ON "properties"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");

-- CreateIndex
CREATE INDEX "property_amenities_amenityId_idx" ON "property_amenities"("amenityId");

-- CreateIndex
CREATE INDEX "property_media_propertyId_sortOrder_idx" ON "property_media"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "property_media_moderation_idx" ON "property_media"("moderation");

-- CreateIndex
CREATE INDEX "rooms_propertyId_status_deletedAt_idx" ON "rooms"("propertyId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "rooms_propertyId_sharingType_baseRentPaise_idx" ON "rooms"("propertyId", "sharingType", "baseRentPaise");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_propertyId_code_key" ON "rooms"("propertyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_propertyId_key" ON "rooms"("id", "propertyId");

-- CreateIndex
CREATE INDEX "beds_propertyId_status_deletedAt_idx" ON "beds"("propertyId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "beds_roomId_code_key" ON "beds"("roomId", "code");

-- CreateIndex
CREATE INDEX "bed_allocations_bedId_status_idx" ON "bed_allocations"("bedId", "status");

-- CreateIndex
CREATE INDEX "bed_allocations_propertyId_status_startDate_idx" ON "bed_allocations"("propertyId", "status", "startDate");

-- CreateIndex
CREATE INDEX "bed_allocations_bookingId_idx" ON "bed_allocations"("bookingId");

-- CreateIndex
CREATE INDEX "bed_allocations_tenancyId_idx" ON "bed_allocations"("tenancyId");

-- CreateIndex
CREATE UNIQUE INDEX "listings_propertyId_key" ON "listings"("propertyId");

-- CreateIndex
CREATE INDEX "listings_status_publishedAt_idx" ON "listings"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "listings_status_availabilityConfirmedAt_idx" ON "listings"("status", "availabilityConfirmedAt");

-- CreateIndex
CREATE INDEX "search_misses_localityId_createdAt_idx" ON "search_misses"("localityId", "createdAt");

-- CreateIndex
CREATE INDEX "visits_propertyId_status_idx" ON "visits"("propertyId", "status");

-- CreateIndex
CREATE INDEX "visits_prospectUserId_createdAt_idx" ON "visits"("prospectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "visits_status_expiresAt_idx" ON "visits"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");

-- CreateIndex
CREATE INDEX "bookings_orgId_status_idx" ON "bookings"("orgId", "status");

-- CreateIndex
CREATE INDEX "bookings_propertyId_status_moveInDate_idx" ON "bookings"("propertyId", "status", "moveInDate");

-- CreateIndex
CREATE INDEX "bookings_tenantUserId_createdAt_idx" ON "bookings"("tenantUserId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_status_approvalExpiresAt_idx" ON "bookings"("status", "approvalExpiresAt");

-- CreateIndex
CREATE INDEX "booking_status_history_bookingId_occurredAt_idx" ON "booking_status_history"("bookingId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenancies_bookingId_key" ON "tenancies"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "tenancies_previousTenancyId_key" ON "tenancies"("previousTenancyId");

-- CreateIndex
CREATE INDEX "tenancies_orgId_status_idx" ON "tenancies"("orgId", "status");

-- CreateIndex
CREATE INDEX "tenancies_propertyId_status_idx" ON "tenancies"("propertyId", "status");

-- CreateIndex
CREATE INDEX "tenancies_tenantUserId_status_idx" ON "tenancies"("tenantUserId", "status");

-- CreateIndex
CREATE INDEX "tenancies_status_cycleAnchorDay_idx" ON "tenancies"("status", "cycleAnchorDay");

-- CreateIndex
CREATE INDEX "tenancy_status_history_tenancyId_occurredAt_idx" ON "tenancy_status_history"("tenancyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_tokens_tokenHash_key" ON "checkin_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "checkin_tokens_bookingId_revokedAt_idx" ON "checkin_tokens"("bookingId", "revokedAt");

-- CreateIndex
CREATE INDEX "checkin_events_propertyId_occurredAt_idx" ON "checkin_events"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "checkin_events_bookingId_idx" ON "checkin_events"("bookingId");

-- CreateIndex
CREATE INDEX "checkin_events_tenancyId_idx" ON "checkin_events"("tenancyId");

-- CreateIndex
CREATE INDEX "audit_log_subjectType_subjectId_occurredAt_idx" ON "audit_log"("subjectType", "subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_orgId_occurredAt_idx" ON "audit_log"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_actorId_occurredAt_idx" ON "audit_log"("actorId", "occurredAt");

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_properties" ADD CONSTRAINT "org_membership_properties_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "org_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_properties" ADD CONSTRAINT "org_membership_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_meal_plans" ADD CONSTRAINT "property_meal_plans_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_rules" ADD CONSTRAINT "property_rules_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_propertyId_fkey" FOREIGN KEY ("roomId", "propertyId") REFERENCES "rooms"("id", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "tenancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_allocations" ADD CONSTRAINT "bed_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_prospectUserId_fkey" FOREIGN KEY ("prospectUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_previousTenancyId_fkey" FOREIGN KEY ("previousTenancyId") REFERENCES "tenancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_status_history" ADD CONSTRAINT "tenancy_status_history_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "tenancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancy_status_history" ADD CONSTRAINT "tenancy_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_tokens" ADD CONSTRAINT "checkin_tokens_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_tokens" ADD CONSTRAINT "checkin_tokens_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_events" ADD CONSTRAINT "checkin_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_events" ADD CONSTRAINT "checkin_events_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "tenancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_events" ADD CONSTRAINT "checkin_events_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_events" ADD CONSTRAINT "checkin_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- ===========================================================================
-- Hand-written schema additions that Prisma cannot express.
-- Appended verbatim to the initial migration. See docs/04_Database_Design.md
-- section A.3 for the reasoning.
--
-- This file is the source of truth for these statements. If they need to
-- change, write a NEW migration -- never edit an applied one.
-- ===========================================================================

-- Required for an exclusion constraint that mixes equality (uuid) with range
-- overlap in a single GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- THE core correctness guarantee of this system.
--
-- Every claim on a bed -- checkout hold, booking, tenancy, maintenance block --
-- is a row in bed_allocations. This constraint makes two overlapping ACTIVE
-- claims on the same bed impossible at the database level.
--
-- Two tenants paying for the last bed in the same millisecond: one commits,
-- the other raises SQLSTATE 23P01, which the service maps to a clean,
-- retryable "bed just taken". An application-level check-then-insert cannot
-- give this guarantee once more than one instance is running.
--
-- A NULL endDate means an open-ended stay: daterange(start, NULL) is unbounded
-- above and blocks every future date until notice sets an end date.
ALTER TABLE "bed_allocations"
    ADD CONSTRAINT "bed_allocation_no_overlap"
    EXCLUDE USING gist (
        "bedId" WITH =,
        daterange("startDate", "endDate", '[)') WITH &&
    ) WHERE ("status" = 'ACTIVE');

-- An allocation must cover at least one day.
ALTER TABLE "bed_allocations"
    ADD CONSTRAINT "bed_allocation_dates_ordered"
    CHECK ("endDate" IS NULL OR "endDate" > "startDate");

-- Holds carry an expiry; nothing else does.
ALTER TABLE "bed_allocations"
    ADD CONSTRAINT "bed_allocation_hold_has_expiry"
    CHECK (("kind" = 'HOLD') = ("expiresAt" IS NOT NULL));

-- The sweeper only ever scans active holds, so index only those.
CREATE INDEX "idx_allocation_hold_expiry"
    ON "bed_allocations" ("expiresAt")
    WHERE "kind" = 'HOLD' AND "status" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Money is integer paise and never negative. Enforced here so that no code
-- path can write a negative amount, whatever the ORM is asked to do.
-- ---------------------------------------------------------------------------
ALTER TABLE "rooms"
    ADD CONSTRAINT "room_rent_non_negative" CHECK ("baseRentPaise" >= 0),
    ADD CONSTRAINT "room_deposit_non_negative" CHECK ("depositPaise" >= 0),
    ADD CONSTRAINT "room_capacity_positive" CHECK ("sharingCapacity" > 0);

ALTER TABLE "beds"
    ADD CONSTRAINT "bed_rent_override_non_negative"
    CHECK ("rentOverridePaise" IS NULL OR "rentOverridePaise" >= 0);

ALTER TABLE "bookings"
    ADD CONSTRAINT "booking_amounts_non_negative"
    CHECK ("agreedRentPaise" >= 0
       AND "agreedDepositPaise" >= 0
       AND "payableNowPaise" >= 0
       AND "convenienceFeePaise" >= 0),
    ADD CONSTRAINT "booking_notice_non_negative"
    CHECK ("noticeDays" >= 0 AND "lockInDays" >= 0);

ALTER TABLE "tenancies"
    ADD CONSTRAINT "tenancy_amounts_non_negative"
    CHECK ("agreedRentPaise" >= 0 AND "depositPaise" >= 0),
    ADD CONSTRAINT "tenancy_dates_ordered"
    CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
    ADD CONSTRAINT "tenancy_cycle_day_valid"
    CHECK ("cycleAnchorDay" IS NULL
           OR ("cycleAnchorDay" >= 1 AND "cycleAnchorDay" <= 31));

ALTER TABLE "properties"
    ADD CONSTRAINT "property_cycle_day_valid"
    CHECK ("defaultRentCycleDay" IS NULL
           OR ("defaultRentCycleDay" >= 1 AND "defaultRentCycleDay" <= 31));

ALTER TABLE "property_meal_plans"
    ADD CONSTRAINT "meal_plan_charge_non_negative"
    CHECK ("extraChargePaise" IS NULL OR "extraChargePaise" >= 0);

-- ---------------------------------------------------------------------------
-- Time windows must be windows.
-- ---------------------------------------------------------------------------
ALTER TABLE "checkin_tokens"
    ADD CONSTRAINT "checkin_token_window_ordered"
    CHECK ("validTo" > "validFrom");

ALTER TABLE "visits"
    ADD CONSTRAINT "visit_window_ordered"
    CHECK ("requestedEnd" > "requestedStart");


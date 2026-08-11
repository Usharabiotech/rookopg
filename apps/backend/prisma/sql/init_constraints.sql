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

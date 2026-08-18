-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "checkinCodeFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "checkinCodeLockedUntil" TIMESTAMPTZ(3);


-- Listings get a stable, human-readable URL segment, assigned once at first
-- publish. Nullable: a draft has no address yet, and Postgres does not treat
-- NULLs as duplicates, so the unique index is safe on existing rows.
ALTER TABLE "listings" ADD COLUMN "slug" VARCHAR(200);

CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

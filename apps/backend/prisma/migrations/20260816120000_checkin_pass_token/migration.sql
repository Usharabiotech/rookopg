-- DropIndex
DROP INDEX "checkin_tokens_tokenHash_key";

-- AlterTable
ALTER TABLE "checkin_tokens" DROP COLUMN "tokenHash",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shortCode" VARCHAR(6) NOT NULL,
ADD COLUMN     "token" VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "checkin_tokens_token_key" ON "checkin_tokens"("token");

-- CreateIndex
CREATE INDEX "checkin_tokens_shortCode_idx" ON "checkin_tokens"("shortCode");


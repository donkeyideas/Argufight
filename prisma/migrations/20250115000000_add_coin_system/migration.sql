-- CreateEnum: CoinTransactionType
CREATE TYPE "CoinTransactionType" AS ENUM (
  'BELT_CHALLENGE_ENTRY',
  'BELT_CHALLENGE_REWARD',
  'BELT_CHALLENGE_CONSOLATION',
  'BELT_TOURNAMENT_CREATION',
  'BELT_TOURNAMENT_REWARD',
  'ADMIN_GRANT',
  'ADMIN_DEDUCT',
  'REFUND',
  'PLATFORM_FEE'
);

-- CreateEnum: CoinTransactionStatus
CREATE TYPE "CoinTransactionStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

-- AlterTable: Add coins field to users
ALTER TABLE "users" ADD COLUMN "coins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: CoinTransaction
CREATE TABLE "coin_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "status" "CoinTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "belt_challenge_id" TEXT,
    "belt_id" TEXT,
    "tournament_id" TEXT,
    "debate_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_idx" ON "coin_transactions"("user_id");
CREATE INDEX "coin_transactions_type_idx" ON "coin_transactions"("type");
CREATE INDEX "coin_transactions_status_idx" ON "coin_transactions"("status");
CREATE INDEX "coin_transactions_created_at_idx" ON "coin_transactions"("created_at");
CREATE INDEX "coin_transactions_belt_challenge_id_idx" ON "coin_transactions"("belt_challenge_id");

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_belt_challenge_id_fkey" FOREIGN KEY ("belt_challenge_id") REFERENCES "belt_challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_belt_id_fkey" FOREIGN KEY ("belt_id") REFERENCES "belts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BeltType" AS ENUM ('ROOKIE', 'CATEGORY', 'CHAMPIONSHIP', 'UNDEFEATED', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "BeltStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'VACANT', 'STAKED', 'GRACE_PERIOD', 'MANDATORY');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BeltTransferReason" AS ENUM ('DEBATE_WIN', 'TOURNAMENT_WIN', 'MANDATORY_LOSS', 'INACTIVITY', 'ADMIN_TRANSFER', 'CHALLENGE_WIN', 'FORFEIT');

-- AlterTable: Add belt stats to users
ALTER TABLE "users" ADD COLUMN "total_belt_wins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "total_belt_defenses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "longest_belt_held" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "current_belts_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add belt fields to debates
ALTER TABLE "debates" ADD COLUMN "has_belt_at_stake" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "debates" ADD COLUMN "belt_stake_type" TEXT;

-- AlterTable: Add belt fields to tournaments
ALTER TABLE "tournaments" ADD COLUMN "belt_created" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tournaments" ADD COLUMN "belt_creation_cost" INTEGER;
ALTER TABLE "tournaments" ADD COLUMN "belt_created_by" TEXT;

-- CreateTable: Belts
CREATE TABLE "belts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BeltType" NOT NULL,
    "category" TEXT,
    "current_holder_id" TEXT,
    "status" "BeltStatus" NOT NULL DEFAULT 'VACANT',
    "acquired_at" TIMESTAMP(3),
    "last_defended_at" TIMESTAMP(3),
    "next_defense_due" TIMESTAMP(3),
    "inactive_at" TIMESTAMP(3),
    "times_defended" INTEGER NOT NULL DEFAULT 0,
    "successful_defenses" INTEGER NOT NULL DEFAULT 0,
    "total_days_held" INTEGER NOT NULL DEFAULT 0,
    "grace_period_ends" TIMESTAMP(3),
    "is_first_holder" BOOLEAN NOT NULL DEFAULT false,
    "is_staked" BOOLEAN NOT NULL DEFAULT false,
    "staked_in_debate_id" TEXT,
    "staked_in_tournament_id" TEXT,
    "tournament_id" TEXT,
    "design_image_url" TEXT,
    "design_colors" JSONB,
    "sponsor_id" TEXT,
    "sponsor_name" TEXT,
    "sponsor_logo_url" TEXT,
    "coin_value" INTEGER NOT NULL DEFAULT 0,
    "creation_cost" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "belts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Belt History
CREATE TABLE "belt_history" (
    "id" TEXT NOT NULL,
    "belt_id" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "reason" "BeltTransferReason" NOT NULL,
    "debate_id" TEXT,
    "tournament_id" TEXT,
    "days_held" INTEGER NOT NULL,
    "defenses_won" INTEGER NOT NULL,
    "defenses_lost" INTEGER NOT NULL,
    "admin_notes" TEXT,
    "transferred_by" TEXT,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "belt_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Belt Challenges
CREATE TABLE "belt_challenges" (
    "id" TEXT NOT NULL,
    "belt_id" TEXT NOT NULL,
    "challenger_id" TEXT NOT NULL,
    "belt_holder_id" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "entry_fee" INTEGER NOT NULL DEFAULT 0,
    "coin_reward" INTEGER NOT NULL DEFAULT 0,
    "response" "ChallengeStatus",
    "responded_at" TIMESTAMP(3),
    "decline_count" INTEGER NOT NULL DEFAULT 0,
    "debate_id" TEXT,
    "challenger_elo" INTEGER NOT NULL,
    "holder_elo" INTEGER NOT NULL,
    "elo_difference" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "belt_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Belt Settings
CREATE TABLE "belt_settings" (
    "id" TEXT NOT NULL,
    "belt_type" "BeltType" NOT NULL,
    "defense_period_days" INTEGER NOT NULL DEFAULT 30,
    "inactivity_days" INTEGER NOT NULL DEFAULT 30,
    "mandatory_defense_days" INTEGER NOT NULL DEFAULT 60,
    "grace_period_days" INTEGER NOT NULL DEFAULT 30,
    "max_declines" INTEGER NOT NULL DEFAULT 2,
    "challenge_cooldown_days" INTEGER NOT NULL DEFAULT 7,
    "challenge_expiry_days" INTEGER NOT NULL DEFAULT 3,
    "elo_range" INTEGER NOT NULL DEFAULT 200,
    "activity_requirement_days" INTEGER NOT NULL DEFAULT 30,
    "win_streak_bonus_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "entry_fee_base" INTEGER NOT NULL DEFAULT 100,
    "entry_fee_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "winner_reward_percent" INTEGER NOT NULL DEFAULT 60,
    "loser_consolation_percent" INTEGER NOT NULL DEFAULT 30,
    "platform_fee_percent" INTEGER NOT NULL DEFAULT 10,
    "tournament_belt_cost_small" INTEGER NOT NULL DEFAULT 500,
    "tournament_belt_cost_medium" INTEGER NOT NULL DEFAULT 1000,
    "tournament_belt_cost_large" INTEGER NOT NULL DEFAULT 2000,
    "inactive_competitor_count" INTEGER NOT NULL DEFAULT 2,
    "inactive_accept_days" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "belt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "belts_current_holder_id_idx" ON "belts"("current_holder_id");
CREATE INDEX "belts_type_idx" ON "belts"("type");
CREATE INDEX "belts_category_idx" ON "belts"("category");
CREATE INDEX "belts_status_idx" ON "belts"("status");
CREATE INDEX "belts_tournament_id_idx" ON "belts"("tournament_id");
CREATE INDEX "belts_staked_in_debate_id_idx" ON "belts"("staked_in_debate_id");
CREATE INDEX "belts_staked_in_tournament_id_idx" ON "belts"("staked_in_tournament_id");

-- CreateIndex
CREATE INDEX "belt_history_belt_id_idx" ON "belt_history"("belt_id");
CREATE INDEX "belt_history_from_user_id_idx" ON "belt_history"("from_user_id");
CREATE INDEX "belt_history_to_user_id_idx" ON "belt_history"("to_user_id");
CREATE INDEX "belt_history_debate_id_idx" ON "belt_history"("debate_id");
CREATE INDEX "belt_history_tournament_id_idx" ON "belt_history"("tournament_id");

-- CreateIndex
CREATE INDEX "belt_challenges_belt_id_idx" ON "belt_challenges"("belt_id");
CREATE INDEX "belt_challenges_challenger_id_idx" ON "belt_challenges"("challenger_id");
CREATE INDEX "belt_challenges_belt_holder_id_idx" ON "belt_challenges"("belt_holder_id");
CREATE INDEX "belt_challenges_status_idx" ON "belt_challenges"("status");
CREATE INDEX "belt_challenges_debate_id_idx" ON "belt_challenges"("debate_id");

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX "belts_staked_in_debate_id_key" ON "belts"("staked_in_debate_id");
CREATE UNIQUE INDEX "belts_tournament_id_key" ON "belts"("tournament_id");
CREATE UNIQUE INDEX "belt_challenges_debate_id_key" ON "belt_challenges"("debate_id");
CREATE UNIQUE INDEX "belt_settings_belt_type_key" ON "belt_settings"("belt_type");

-- AddForeignKey
ALTER TABLE "belts" ADD CONSTRAINT "belts_current_holder_id_fkey" FOREIGN KEY ("current_holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belts" ADD CONSTRAINT "belts_staked_in_debate_id_fkey" FOREIGN KEY ("staked_in_debate_id") REFERENCES "debates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belts" ADD CONSTRAINT "belts_staked_in_tournament_id_fkey" FOREIGN KEY ("staked_in_tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belts" ADD CONSTRAINT "belts_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "belt_history" ADD CONSTRAINT "belt_history_belt_id_fkey" FOREIGN KEY ("belt_id") REFERENCES "belts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "belt_history" ADD CONSTRAINT "belt_history_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belt_history" ADD CONSTRAINT "belt_history_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belt_history" ADD CONSTRAINT "belt_history_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "belt_history" ADD CONSTRAINT "belt_history_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "belt_challenges" ADD CONSTRAINT "belt_challenges_belt_id_fkey" FOREIGN KEY ("belt_id") REFERENCES "belts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "belt_challenges" ADD CONSTRAINT "belt_challenges_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "belt_challenges" ADD CONSTRAINT "belt_challenges_belt_holder_id_fkey" FOREIGN KEY ("belt_holder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "belt_challenges" ADD CONSTRAINT "belt_challenges_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

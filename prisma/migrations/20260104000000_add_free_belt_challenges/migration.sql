-- AlterTable: Add free belt challenge fields to users
ALTER TABLE "users" ADD COLUMN "free_belt_challenges_available" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "last_free_challenge_reset" TIMESTAMP(3);

-- AlterTable: Add uses_free_challenge field to belt_challenges
ALTER TABLE "belt_challenges" ADD COLUMN "uses_free_challenge" BOOLEAN NOT NULL DEFAULT false;

-- Initialize last_free_challenge_reset for existing users
UPDATE "users" SET "last_free_challenge_reset" = CURRENT_TIMESTAMP WHERE "last_free_challenge_reset" IS NULL;

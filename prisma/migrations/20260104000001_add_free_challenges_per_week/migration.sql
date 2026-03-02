-- AlterTable: Add free_challenges_per_week to belt_settings
ALTER TABLE "belt_settings" ADD COLUMN IF NOT EXISTS "free_challenges_per_week" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Add TournamentFormat enum and format field
CREATE TYPE "TournamentFormat" AS ENUM ('BRACKET', 'CHAMPIONSHIP');

ALTER TABLE "tournaments" ADD COLUMN "format" "TournamentFormat" NOT NULL DEFAULT 'BRACKET';
ALTER TABLE "tournaments" ADD COLUMN "assigned_judges" TEXT;

-- AlterTable: Add selectedPosition to TournamentParticipant
ALTER TABLE "tournament_participants" ADD COLUMN "selected_position" TEXT;

-- AlterTable: Add score fields to TournamentMatch
ALTER TABLE "tournament_matches" ADD COLUMN "participant1_score" INTEGER;
ALTER TABLE "tournament_matches" ADD COLUMN "participant2_score" INTEGER;
ALTER TABLE "tournament_matches" ADD COLUMN "participant1_score_breakdown" JSONB;
ALTER TABLE "tournament_matches" ADD COLUMN "participant2_score_breakdown" JSONB;









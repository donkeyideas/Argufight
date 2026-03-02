-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost" REAL NOT NULL DEFAULT 0,
    "cost_per_1k_tokens" REAL,
    "debate_id" TEXT,
    "user_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "response_time" INTEGER,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_usage_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_debates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "challenger_id" TEXT NOT NULL,
    "opponent_id" TEXT,
    "challenger_position" TEXT NOT NULL,
    "opponent_position" TEXT NOT NULL,
    "total_rounds" INTEGER NOT NULL DEFAULT 5,
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "round_duration" INTEGER NOT NULL DEFAULT 86400000,
    "speed_mode" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "winner_id" TEXT,
    "verdict_reached" BOOLEAN NOT NULL DEFAULT false,
    "verdict_date" DATETIME,
    "appealed_at" DATETIME,
    "appeal_status" TEXT,
    "appeal_count" INTEGER NOT NULL DEFAULT 0,
    "appealed_by" TEXT,
    "original_winner_id" TEXT,
    "spectator_count" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "challenger_elo_change" INTEGER,
    "opponent_elo_change" INTEGER,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "round_deadline" DATETIME,
    CONSTRAINT "debates_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debates_opponent_id_fkey" FOREIGN KEY ("opponent_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_debates" ("category", "challenger_elo_change", "challenger_id", "challenger_position", "created_at", "current_round", "description", "ended_at", "featured", "id", "opponent_elo_change", "opponent_id", "opponent_position", "round_deadline", "round_duration", "spectator_count", "speed_mode", "started_at", "status", "topic", "total_rounds", "updated_at", "verdict_date", "verdict_reached", "winner_id") SELECT "category", "challenger_elo_change", "challenger_id", "challenger_position", "created_at", "current_round", "description", "ended_at", "featured", "id", "opponent_elo_change", "opponent_id", "opponent_position", "round_deadline", "round_duration", "spectator_count", "speed_mode", "started_at", "status", "topic", "total_rounds", "updated_at", "verdict_date", "verdict_reached", "winner_id" FROM "debates";
DROP TABLE "debates";
ALTER TABLE "new_debates" RENAME TO "debates";
CREATE INDEX "debates_status_idx" ON "debates"("status");
CREATE INDEX "debates_category_idx" ON "debates"("category");
CREATE INDEX "debates_created_at_idx" ON "debates"("created_at");
CREATE INDEX "debates_challenger_id_idx" ON "debates"("challenger_id");
CREATE INDEX "debates_opponent_id_idx" ON "debates"("opponent_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "api_usage_provider_idx" ON "api_usage"("provider");

-- CreateIndex
CREATE INDEX "api_usage_debate_id_idx" ON "api_usage"("debate_id");

-- CreateIndex
CREATE INDEX "api_usage_user_id_idx" ON "api_usage"("user_id");

-- CreateIndex
CREATE INDEX "api_usage_created_at_idx" ON "api_usage"("created_at");

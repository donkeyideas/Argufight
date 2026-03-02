-- CreateTable
CREATE TABLE "debates" (
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

-- CreateTable
CREATE TABLE "statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagged_reason" TEXT,
    "moderated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "statements_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "statements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "judges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "debates_judged" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "verdicts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "judge_id" TEXT NOT NULL,
    "winner_id" TEXT,
    "decision" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "challenger_score" INTEGER,
    "opponent_score" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verdicts_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "verdicts_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "judges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "debate_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "deleted_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "resolution" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "predicted_winner_id" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "correct" BOOLEAN,
    "points" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "predictions_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "category" TEXT,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "seed_debates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "challenger_name" TEXT NOT NULL,
    "opponent_name" TEXT NOT NULL,
    "statements" TEXT NOT NULL,
    "verdict_data" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "elo_rating" INTEGER NOT NULL DEFAULT 1200,
    "debates_won" INTEGER NOT NULL DEFAULT 0,
    "debates_lost" INTEGER NOT NULL DEFAULT 0,
    "debates_tied" INTEGER NOT NULL DEFAULT 0,
    "total_debates" INTEGER NOT NULL DEFAULT 0,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "banned_until" DATETIME,
    "ban_reason" TEXT,
    "ranked_banned" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_users" ("avatar_url", "bio", "created_at", "debates_lost", "debates_tied", "debates_won", "elo_rating", "email", "id", "is_admin", "is_banned", "password_hash", "total_debates", "updated_at", "username") SELECT "avatar_url", "bio", "created_at", "debates_lost", "debates_tied", "debates_won", "elo_rating", "email", "id", "is_admin", "is_banned", "password_hash", "total_debates", "updated_at", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_username_idx" ON "users"("username");
CREATE INDEX "users_elo_rating_idx" ON "users"("elo_rating");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "debates_status_idx" ON "debates"("status");

-- CreateIndex
CREATE INDEX "debates_category_idx" ON "debates"("category");

-- CreateIndex
CREATE INDEX "debates_created_at_idx" ON "debates"("created_at");

-- CreateIndex
CREATE INDEX "debates_challenger_id_idx" ON "debates"("challenger_id");

-- CreateIndex
CREATE INDEX "debates_opponent_id_idx" ON "debates"("opponent_id");

-- CreateIndex
CREATE INDEX "statements_debate_id_idx" ON "statements"("debate_id");

-- CreateIndex
CREATE INDEX "statements_author_id_idx" ON "statements"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "statements_debate_id_author_id_round_key" ON "statements"("debate_id", "author_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "judges_name_key" ON "judges"("name");

-- CreateIndex
CREATE INDEX "verdicts_debate_id_idx" ON "verdicts"("debate_id");

-- CreateIndex
CREATE UNIQUE INDEX "verdicts_debate_id_judge_id_key" ON "verdicts"("debate_id", "judge_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "chat_messages_debate_id_idx" ON "chat_messages"("debate_id");

-- CreateIndex
CREATE INDEX "chat_messages_author_id_idx" ON "chat_messages"("author_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "predictions_user_id_idx" ON "predictions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_debate_id_user_id_key" ON "predictions"("debate_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_key_key" ON "admin_settings"("key");

-- CreateIndex
CREATE INDEX "admin_settings_category_idx" ON "admin_settings"("category");

-- CreateIndex
CREATE INDEX "seed_debates_category_idx" ON "seed_debates"("category");

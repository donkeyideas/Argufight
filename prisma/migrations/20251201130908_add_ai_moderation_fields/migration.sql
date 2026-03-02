-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "resolution" TEXT,
    "ai_moderated" BOOLEAN NOT NULL DEFAULT false,
    "ai_action" TEXT,
    "ai_confidence" INTEGER,
    "ai_reasoning" TEXT,
    "ai_severity" TEXT,
    "ai_moderated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reports" ("created_at", "debate_id", "description", "id", "reason", "reporter_id", "resolution", "reviewed_at", "reviewed_by", "status") SELECT "created_at", "debate_id", "description", "id", "reason", "reporter_id", "resolution", "reviewed_at", "reviewed_by", "status" FROM "reports";
DROP TABLE "reports";
ALTER TABLE "new_reports" RENAME TO "reports";
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE INDEX "reports_ai_moderated_idx" ON "reports"("ai_moderated");
CREATE TABLE "new_statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagged_reason" TEXT,
    "moderated_at" DATETIME,
    "ai_moderated" BOOLEAN NOT NULL DEFAULT false,
    "ai_action" TEXT,
    "ai_confidence" INTEGER,
    "ai_reasoning" TEXT,
    "ai_severity" TEXT,
    "ai_moderated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "statements_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "statements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_statements" ("author_id", "content", "created_at", "debate_id", "flagged", "flagged_reason", "id", "moderated_at", "round", "updated_at") SELECT "author_id", "content", "created_at", "debate_id", "flagged", "flagged_reason", "id", "moderated_at", "round", "updated_at" FROM "statements";
DROP TABLE "statements";
ALTER TABLE "new_statements" RENAME TO "statements";
CREATE INDEX "statements_debate_id_idx" ON "statements"("debate_id");
CREATE INDEX "statements_author_id_idx" ON "statements"("author_id");
CREATE UNIQUE INDEX "statements_debate_id_author_id_round_key" ON "statements"("debate_id", "author_id", "round");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

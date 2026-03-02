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
    "employee_role" TEXT,
    "access_level" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "banned_until" DATETIME,
    "ban_reason" TEXT,
    "ranked_banned" BOOLEAN NOT NULL DEFAULT false,
    "tutorial_completed" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_users" ("access_level", "avatar_url", "ban_reason", "banned_until", "bio", "created_at", "debates_lost", "debates_tied", "debates_won", "elo_rating", "email", "employee_role", "id", "is_admin", "is_banned", "password_hash", "ranked_banned", "strikes", "total_debates", "updated_at", "username") SELECT "access_level", "avatar_url", "ban_reason", "banned_until", "bio", "created_at", "debates_lost", "debates_tied", "debates_won", "elo_rating", "email", "employee_role", "id", "is_admin", "is_banned", "password_hash", "ranked_banned", "strikes", "total_debates", "updated_at", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_username_idx" ON "users"("username");
CREATE INDEX "users_elo_rating_idx" ON "users"("elo_rating");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

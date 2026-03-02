-- CreateTable
CREATE TABLE "debate_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debate_likes_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debate_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debate_saves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debate_saves_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debate_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debate_shares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debate_shares_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debate_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debate_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "deleted_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "debate_comments_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debate_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debate_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "debate_comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "debate_likes_debate_id_idx" ON "debate_likes"("debate_id");

-- CreateIndex
CREATE INDEX "debate_likes_user_id_idx" ON "debate_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_likes_debate_id_user_id_key" ON "debate_likes"("debate_id", "user_id");

-- CreateIndex
CREATE INDEX "debate_saves_debate_id_idx" ON "debate_saves"("debate_id");

-- CreateIndex
CREATE INDEX "debate_saves_user_id_idx" ON "debate_saves"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_saves_debate_id_user_id_key" ON "debate_saves"("debate_id", "user_id");

-- CreateIndex
CREATE INDEX "debate_shares_debate_id_idx" ON "debate_shares"("debate_id");

-- CreateIndex
CREATE INDEX "debate_shares_user_id_idx" ON "debate_shares"("user_id");

-- CreateIndex
CREATE INDEX "debate_comments_debate_id_idx" ON "debate_comments"("debate_id");

-- CreateIndex
CREATE INDEX "debate_comments_user_id_idx" ON "debate_comments"("user_id");

-- CreateIndex
CREATE INDEX "debate_comments_parent_id_idx" ON "debate_comments"("parent_id");

-- CreateIndex
CREATE INDEX "debate_comments_created_at_idx" ON "debate_comments"("created_at");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

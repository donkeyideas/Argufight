-- Add missing indexes for query performance

-- User model indexes (table: users)
CREATE INDEX IF NOT EXISTS "User_isBanned_idx" ON "users"("is_banned");
CREATE INDEX IF NOT EXISTS "User_isAdmin_idx" ON "users"("is_admin");
CREATE INDEX IF NOT EXISTS "User_coins_idx" ON "users"("coins");

-- ChatMessage composite index for debate chat queries (table: chat_messages)
CREATE INDEX IF NOT EXISTS "ChatMessage_debateId_createdAt_idx" ON "chat_messages"("debate_id", "created_at");

-- DebateComment composite index for debate comment queries (table: debate_comments)
CREATE INDEX IF NOT EXISTS "DebateComment_debateId_createdAt_idx" ON "debate_comments"("debate_id", "created_at");

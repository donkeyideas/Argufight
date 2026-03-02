-- CreateTable: Add DebateParticipant model for multi-participant debates
CREATE TABLE IF NOT EXISTS "debate_participants" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" "DebatePosition" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debate_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Add unique constraint on debate_id and user_id
CREATE UNIQUE INDEX IF NOT EXISTS "debate_participants_debate_id_user_id_key" ON "debate_participants"("debate_id", "user_id");

-- CreateIndex: Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS "debate_participants_debate_id_idx" ON "debate_participants"("debate_id");
CREATE INDEX IF NOT EXISTS "debate_participants_user_id_idx" ON "debate_participants"("user_id");
CREATE INDEX IF NOT EXISTS "debate_participants_status_idx" ON "debate_participants"("status");

-- AddForeignKey: Link DebateParticipant to Debate
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'debate_participants_debate_id_fkey'
    ) THEN
        ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_debate_id_fkey" 
        FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: Link DebateParticipant to User
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'debate_participants_user_id_fkey'
    ) THEN
        ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;









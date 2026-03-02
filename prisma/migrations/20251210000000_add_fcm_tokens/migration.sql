-- CreateTable: Add FCMToken model for push notifications
CREATE TABLE IF NOT EXISTS "fcm_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "device" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Add unique constraint on token
CREATE UNIQUE INDEX IF NOT EXISTS "fcm_tokens_token_key" ON "fcm_tokens"("token");

-- CreateIndex: Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "fcm_tokens_user_id_idx" ON "fcm_tokens"("user_id");

-- AddForeignKey: Link FCMToken to User
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fcm_tokens_user_id_fkey'
    ) THEN
        ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;









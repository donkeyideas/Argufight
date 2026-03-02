-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(50);

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "stripe_payment_id" VARCHAR(255);

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP;

-- AlterEnum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PENDING_PAYMENT' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CampaignStatus')
    ) THEN
        ALTER TYPE "CampaignStatus" ADD VALUE 'PENDING_PAYMENT';
    END IF;
END $$;

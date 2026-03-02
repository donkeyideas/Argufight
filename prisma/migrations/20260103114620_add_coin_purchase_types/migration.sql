-- Add COIN_PURCHASE and COIN_PURCHASE_REFUND to CoinTransactionType enum
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE, so we check first

DO $$ 
BEGIN
    -- Add COIN_PURCHASE if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COIN_PURCHASE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CoinTransactionType')
    ) THEN
        ALTER TYPE "CoinTransactionType" ADD VALUE 'COIN_PURCHASE';
    END IF;

    -- Add COIN_PURCHASE_REFUND if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COIN_PURCHASE_REFUND' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CoinTransactionType')
    ) THEN
        ALTER TYPE "CoinTransactionType" ADD VALUE 'COIN_PURCHASE_REFUND';
    END IF;
END $$;

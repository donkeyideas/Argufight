-- Add KING_OF_THE_HILL to TournamentFormat enum
DO $$
BEGIN
    -- Check if enum value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'KING_OF_THE_HILL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TournamentFormat')
    ) THEN
        ALTER TYPE "TournamentFormat" ADD VALUE 'KING_OF_THE_HILL';
    END IF;
END $$;









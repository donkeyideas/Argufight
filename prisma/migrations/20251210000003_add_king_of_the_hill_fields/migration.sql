-- Add King of the Hill specific fields to tournament_participants
ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS cumulative_score INTEGER,
ADD COLUMN IF NOT EXISTS elimination_round INTEGER,
ADD COLUMN IF NOT EXISTS elimination_reason TEXT;

-- Add index for elimination_round for faster queries
CREATE INDEX IF NOT EXISTS idx_tournament_participants_elimination_round ON tournament_participants(elimination_round);









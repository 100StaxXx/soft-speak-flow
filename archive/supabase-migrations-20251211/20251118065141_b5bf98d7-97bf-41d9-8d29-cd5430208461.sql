-- Add energy and attributes to user_companion table
ALTER TABLE user_companion
ADD COLUMN energy INTEGER DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
ADD COLUMN resilience INTEGER DEFAULT 0 CHECK (resilience >= 0 AND resilience <= 100),
ADD COLUMN focus INTEGER DEFAULT 0 CHECK (focus >= 0 AND focus <= 100),
ADD COLUMN balance INTEGER DEFAULT 0 CHECK (balance >= 0 AND balance <= 100),
ADD COLUMN last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient queries
CREATE INDEX idx_companion_energy ON user_companion(energy);

-- Comment on new columns
COMMENT ON COLUMN user_companion.energy IS 'Companion energy level (0-100), increases with daily activity';
COMMENT ON COLUMN user_companion.resilience IS 'Resilience attribute (0-100), grows from maintaining streaks';
COMMENT ON COLUMN user_companion.focus IS 'Focus attribute (0-100), grows from completing missions and habits';
COMMENT ON COLUMN user_companion.balance IS 'Balance attribute (0-100), grows from check-ins and reflections';
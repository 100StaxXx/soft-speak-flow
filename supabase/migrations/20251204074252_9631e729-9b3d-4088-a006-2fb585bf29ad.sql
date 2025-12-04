-- Add faction column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS faction TEXT CHECK (faction IN ('starfall', 'void', 'stellar'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.faction IS 'User chosen cosmic expedition faction: starfall (Starfall Fleet), void (Void Collective), stellar (Stellar Voyagers)';
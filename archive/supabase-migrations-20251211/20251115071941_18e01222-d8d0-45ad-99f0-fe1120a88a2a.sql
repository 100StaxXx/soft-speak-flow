-- Update adaptive_push_settings table to support multi-category
ALTER TABLE adaptive_push_settings 
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS last_category_index INTEGER DEFAULT 0;

-- Update adaptive_push_queue table to include category
ALTER TABLE adaptive_push_queue
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_push_queue_delivery 
ON adaptive_push_queue(delivered, scheduled_for) 
WHERE delivered = false;
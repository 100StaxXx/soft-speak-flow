-- Add unique constraint on quotes text to prevent duplicates
ALTER TABLE quotes
ADD CONSTRAINT quotes_text_unique UNIQUE (text);
-- Delete Darius and Solace mentors
DELETE FROM mentors WHERE slug IN ('darius', 'solace');

-- Rename Elizabeth to Solace
UPDATE mentors 
SET name = 'Solace', 
    slug = 'solace'
WHERE slug = 'elizabeth';
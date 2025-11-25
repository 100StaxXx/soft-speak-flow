-- Add energy_cost column to companion_evolution_cards
ALTER TABLE companion_evolution_cards
ADD COLUMN energy_cost integer NOT NULL DEFAULT 1;
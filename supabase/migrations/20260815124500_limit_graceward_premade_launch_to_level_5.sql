-- Graceward launches with the Young and Growing visual forms. The schema keeps
-- later boundary values valid so the remaining release can be added without a
-- destructive table change, but they are not part of the active asset contract.

DELETE FROM public.companion_premade_asset_contracts
WHERE product_mode = 'graceward'
  AND (
    boundary_level > 5
    OR species NOT IN ('lion', 'dove', 'wolf')
    OR element NOT IN ('light', 'nature')
  );

COMMENT ON TABLE public.companion_premade_asset_contracts IS
  'Expected Higgsfield portrait/video matrix. Graceward is release-scoped to Lion/Dove/Wolf, Light/Nature, and visual boundaries 1 and 5; Cosmiq retains its complete progression contract.';

-- A user should not have two budgets for the same category + period.
-- Standard UNIQUE(owner_id, category_id, period) fails when category_id IS NULL
-- because NULL != NULL in SQL, allowing duplicate global budgets.
-- Two partial indexes handle each case correctly.

-- One category-specific budget per user per period
CREATE UNIQUE INDEX idx_budgets_owner_category_period
  ON budgets(owner_id, category_id, period)
  WHERE category_id IS NOT NULL;

-- One global budget per user per period
CREATE UNIQUE INDEX idx_budgets_owner_global_period
  ON budgets(owner_id, period)
  WHERE category_id IS NULL;

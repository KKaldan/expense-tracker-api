CREATE TABLE budgets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NULL category_id = a global spending cap across all categories.
  category_id UUID          REFERENCES categories(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  period      TEXT          NOT NULL CHECK (period IN ('monthly', 'yearly')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budgets_owner ON budgets(owner_id);

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

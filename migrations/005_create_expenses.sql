CREATE TABLE expenses (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID          REFERENCES categories(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3)       NOT NULL DEFAULT 'GBP',
  description TEXT,
  date        DATE          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Covers the primary list query: all expenses for a user ordered by date.
CREATE INDEX idx_expenses_owner_date ON expenses(owner_id, date DESC);

-- Covers category-filter queries and budget calculations.
CREATE INDEX idx_expenses_owner_cat ON expenses(owner_id, category_id);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

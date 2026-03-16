CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID        REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  icon       TEXT,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Two separate partial unique indexes because a standard UNIQUE(owner_id, name)
-- would allow duplicate system-category names (NULLs are never equal in SQL).
CREATE UNIQUE INDEX idx_categories_system_name
  ON categories(name)
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX idx_categories_user_name
  ON categories(owner_id, name)
  WHERE owner_id IS NOT NULL;

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- System default categories (owner_id = NULL), visible to all users.
INSERT INTO categories (owner_id, name, icon, color) VALUES
  (NULL, 'Food & Drink',  '🍔', '#E74C3C'),
  (NULL, 'Transport',     '🚗', '#3498DB'),
  (NULL, 'Housing',       '🏠', '#2ECC71'),
  (NULL, 'Entertainment', '🎬', '#9B59B6'),
  (NULL, 'Health',        '💊', '#1ABC9C'),
  (NULL, 'Shopping',      '🛍️',  '#E67E22'),
  (NULL, 'Utilities',     '💡', '#F39C12'),
  (NULL, 'Travel',        '✈️',  '#2980B9'),
  (NULL, 'Education',     '📚', '#8E44AD'),
  (NULL, 'Other',         '📦', '#95A5A6');

-- Reusable trigger function for maintaining updated_at on any table.
-- Created here once; referenced by subsequent migrations.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup by hash on every /auth/refresh call — must be fast.
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

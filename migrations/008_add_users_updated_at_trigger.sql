-- The set_updated_at() trigger function was defined in 003_create_refresh_tokens.sql.
-- It was not applied to the users table at the time — this migration adds it.
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 002_create_users.sql gave these columns defaults but omitted NOT NULL,
-- unlike every other table. This brings users in line with the rest.
ALTER TABLE users
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

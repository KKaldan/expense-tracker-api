-- A token family is every refresh token descended from one login. If an
-- already-rotated token is presented again, it has been copied, and the
-- whole family (that one session) is revoked — see auth.service.js.
ALTER TABLE refresh_tokens ADD COLUMN family_id UUID;

-- Tokens issued before families existed each become a family of one, so a
-- replay of one of them revokes only itself.
UPDATE refresh_tokens SET family_id = gen_random_uuid();

ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;

-- Reuse detection revokes by family.
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

-- Profile pictures.
--
-- Forward-only, as section 3 prescribes once a database has data worth keeping: 002
-- carries the same table, so a fresh volume needs nothing from this file, and the
-- IF NOT EXISTS / IF EXISTS pair lets the two run in either order.
--
-- The bytes live here rather than a URL living here. Nothing in the company serves
-- these pictures — Active Directory authenticates and holds no photographs — so a
-- column of URLs would have been a column pointing at nowhere. Forty thumbnails is a
-- few hundred kilobytes, which Postgres holds without noticing, and it keeps the
-- application self-contained: no volume to back up separately, no file share to
-- survive a redeploy.
--
-- A table of its own, not two more columns on psepre_app_user. Every query about a
-- person selects that row, and none of them want an image: kept there, the bytes
-- would travel to the calendar, to every plan and to every roster to be thrown away.

SET search_path TO dev;

-- An earlier revision of this file added a URL column. Nothing ever wrote to it.
ALTER TABLE psepre_app_user DROP COLUMN IF EXISTS avatar_url;

CREATE TABLE IF NOT EXISTS psepre_user_avatar (
    user_id SMALLINT PRIMARY KEY,
    content_type VARCHAR(64) NOT NULL,
    bytes BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id) ON DELETE CASCADE,
    CONSTRAINT ck_user_avatar_type
        CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp'))
);

COMMENT ON TABLE psepre_user_avatar IS
    'One picture per person, or no row at all. Separate from psepre_app_user so that the queries which ask who somebody is never carry their photograph with them.';
COMMENT ON COLUMN psepre_user_avatar.user_id IS
    'Who the picture is of. Primary key as well as foreign key: a person has one picture or none, and deleting the person takes it with them.';
COMMENT ON COLUMN psepre_user_avatar.content_type IS
    'The image type, checked on the way in and sent back on the way out, so the browser is never asked to guess.';
COMMENT ON COLUMN psepre_user_avatar.bytes IS
    'The image itself. Held here rather than on disk so the application has no second place to keep in step.';
COMMENT ON COLUMN psepre_user_avatar.updated_at IS
    'When the picture last changed. Travels in the URL the interface asks for, so a replaced picture is fetched again instead of being served from the cache.';

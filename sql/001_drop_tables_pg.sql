-- Drop_tables
-- Target DB: pse_presence
--
-- Not run by the container. This is the manual reset for a database you want to
-- rebuild in place without dropping the volume. Order is reverse dependency order.

SET search_path TO dev;

DROP TABLE IF EXISTS psepre_swap_request;
DROP TABLE IF EXISTS psepre_auth_token;
DROP TABLE IF EXISTS psepre_plan_assignment;
DROP TABLE IF EXISTS psepre_plan_day;
DROP TABLE IF EXISTS psepre_plan;
DROP TABLE IF EXISTS psepre_absence;
DROP TABLE IF EXISTS psepre_absence_import;
DROP TABLE IF EXISTS psepre_holiday;
DROP TABLE IF EXISTS psepre_user_avatar;
DROP TABLE IF EXISTS psepre_team_member;
DROP TABLE IF EXISTS psepre_app_user;
DROP TABLE IF EXISTS psepre_team;

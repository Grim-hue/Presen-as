-- Create_tables
-- Target DB: pse_presence
--
-- Run once by the db container when it initialises an empty volume.
-- This is not a migration tool: to change the schema during development, drop the
-- volume and let this file run again. See AGENTS.md section 2.

CREATE SCHEMA IF NOT EXISTS dev;

SET search_path TO dev;

-- Required by the exclusion constraint on psepre_plan, which mixes an equality test
-- on team_id with a range overlap test on the plan period.
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- =====================================================================
-- table dev.psepre_team
-- =====================================================================

CREATE TABLE psepre_team (
    team_id SMALLSERIAL PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    on_site_weekday SMALLINT NOT NULL DEFAULT 1,
    required_on_site SMALLINT NOT NULL DEFAULT 2,
    fairness_since DATE NOT NULL,
    email_subject VARCHAR(160) NOT NULL,
    email_intro VARCHAR(512) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT ck_team_weekday_iso
        CHECK (on_site_weekday BETWEEN 1 AND 7),
    CONSTRAINT ck_team_required_positive
        CHECK (required_on_site > 0)
);

COMMENT ON TABLE psepre_team IS 'A team subject to an on-site attendance rule, and the rule itself.';
COMMENT ON COLUMN psepre_team.team_id IS 'Unique identifier of the team.';
COMMENT ON COLUMN psepre_team.name IS 'Display name of the team, unique across the application.';
COMMENT ON COLUMN psepre_team.on_site_weekday IS 'Weekday the team must attend, ISO-8601: 1 = Monday through 7 = Sunday. Matches java.time.DayOfWeek.getValue() and Postgres ISODOW. Not Postgres DOW, which is 0 = Sunday.';
COMMENT ON COLUMN psepre_team.required_on_site IS 'How many members must be present on that weekday. Fewer eligible members marks the day understaffed rather than failing generation.';
COMMENT ON COLUMN psepre_team.fairness_since IS 'Date the fairness ledger starts counting from. Published plan days before this are ignored when replaying balances, so moving it forward resets the ledger without deleting history.';
COMMENT ON COLUMN psepre_team.email_subject IS 'Subject line of the generated email, as a template. Two tokens are substituted: {meses} for the month names alone and {meses_ano} for the same with the year. Both are said the way a person says them: one or two months are a list ("agosto", "setembro e outubro 2026"), three or more consecutive months are a range ("de setembro a dezembro 2026"), months with a gap between them stay a list whatever their number, and the year is said once when the whole list is inside one. Held per team because the two commitments address different readers: the internal plan and the client-facing AT roster do not share a subject.';
COMMENT ON COLUMN psepre_team.email_intro IS 'Opening paragraph of the generated email, over the same {meses} and {meses_ano} tokens. This is where the commitment says whose elements go where, which is the sentence that differs between the PSE office and the AT premises.';
COMMENT ON COLUMN psepre_team.active IS 'Inactive teams are soft-deleted and excluded from generation.';
COMMENT ON COLUMN psepre_team.created_at IS 'Timestamp when the team was created.';
COMMENT ON COLUMN psepre_team.updated_at IS 'Timestamp of the last update to the team record.';


-- =====================================================================
-- table dev.psepre_app_user
-- =====================================================================

CREATE TABLE psepre_app_user (
    user_id SMALLSERIAL PRIMARY KEY,
    forename VARCHAR(32) NOT NULL,
    surname VARCHAR(32) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    username VARCHAR(64) UNIQUE NULL,
    password_hash VARCHAR(72) NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE psepre_app_user IS 'Application user. Authentication goes through a provider interface, so a row can be backed by a local password today and by Active Directory later without changing shape.';
COMMENT ON COLUMN psepre_app_user.user_id IS 'Unique identifier of the user.';
COMMENT ON COLUMN psepre_app_user.forename IS 'User given name, shown in plans and in the email.';
COMMENT ON COLUMN psepre_app_user.surname IS 'User family name.';
COMMENT ON COLUMN psepre_app_user.email IS 'Work email address, unique.';
COMMENT ON COLUMN psepre_app_user.username IS 'Login identifier. Holds the Active Directory sAMAccountName once AD authentication is enabled; null for users that only ever authenticated locally.';
COMMENT ON COLUMN psepre_app_user.password_hash IS 'BCrypt hash of the local password. Null when the user authenticates through an external provider, so a null here is not a missing password, it means local login is not available for this user.';
COMMENT ON COLUMN psepre_app_user.is_admin IS 'Administrators may generate and publish plans, import absences and edit the team rule.';
COMMENT ON COLUMN psepre_app_user.active IS 'Inactive users are soft-deleted and cannot authenticate.';
COMMENT ON COLUMN psepre_app_user.created_at IS 'Timestamp when the user was created.';
COMMENT ON COLUMN psepre_app_user.updated_at IS 'Timestamp of the last update to the user record.';


-- =====================================================================
-- table dev.psepre_user_avatar
-- =====================================================================
-- A table of its own rather than two more columns on psepre_app_user: every query
-- about a person selects that row and none of them want an image, so kept there the
-- bytes would travel to the calendar, to every plan and to every roster to be thrown
-- away. The bytes rather than a URL because nothing else serves these pictures.

CREATE TABLE psepre_user_avatar (
    user_id SMALLINT PRIMARY KEY,
    content_type VARCHAR(64) NOT NULL,
    bytes BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id) ON DELETE CASCADE,
    CONSTRAINT ck_user_avatar_type
        CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp'))
);

COMMENT ON TABLE psepre_user_avatar IS 'One picture per person, or no row at all. Separate from psepre_app_user so that the queries which ask who somebody is never carry their photograph with them.';
COMMENT ON COLUMN psepre_user_avatar.user_id IS 'Who the picture is of. Primary key as well as foreign key: a person has one picture or none, and deleting the person takes it with them.';
COMMENT ON COLUMN psepre_user_avatar.content_type IS 'The image type, checked on the way in and sent back on the way out, so the browser is never asked to guess.';
COMMENT ON COLUMN psepre_user_avatar.bytes IS 'The image itself. Held here rather than on disk so the application has no second place to keep in step.';
COMMENT ON COLUMN psepre_user_avatar.updated_at IS 'When the picture last changed. Travels in the URL the interface asks for, so a replaced picture is fetched again instead of being served from the cache.';


-- =====================================================================
-- table dev.psepre_team_member
-- =====================================================================

CREATE TABLE psepre_team_member (
    team_id SMALLINT NOT NULL,
    user_id SMALLINT NOT NULL,
    joined_at DATE NOT NULL,
    left_at DATE NULL,
    PRIMARY KEY (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES psepre_team(team_id),
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id),
    CONSTRAINT ck_team_member_period
        CHECK (left_at IS NULL OR left_at > joined_at)
);

COMMENT ON TABLE psepre_team_member IS 'Membership of a user in a team, bounded in time. The dates are load-bearing: the fairness ledger only accrues for a member on days they were actually in the team, which is what stops a mid-year joiner from owing earlier days.';
COMMENT ON COLUMN psepre_team_member.team_id IS 'Team the user belongs to.';
COMMENT ON COLUMN psepre_team_member.user_id IS 'Member.';
COMMENT ON COLUMN psepre_team_member.joined_at IS 'First date the member counts towards the rule and starts accruing expected share.';
COMMENT ON COLUMN psepre_team_member.left_at IS 'First date the member no longer counts, exclusive. Null while still in the team. One row per user per team, so a member who leaves and returns needs their joined_at moved rather than a second row.';


-- =====================================================================
-- table dev.psepre_holiday
-- =====================================================================

CREATE TABLE psepre_holiday (
    holiday_id SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL,
    name VARCHAR(64) NOT NULL,
    national BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE psepre_holiday IS 'Public holidays. A holiday landing on the on-site weekday produces a plan day with no assignments and no fairness accrual.';
COMMENT ON COLUMN psepre_holiday.holiday_id IS 'Unique identifier of the holiday entry.';
COMMENT ON COLUMN psepre_holiday.holiday_date IS 'The date itself. Moveable feasts are stored per year rather than computed at read time; HolidayDomain derives them when generating a new year.';
COMMENT ON COLUMN psepre_holiday.name IS 'Holiday name in Portuguese, shown in the plan and in the generated email.';
COMMENT ON COLUMN psepre_holiday.national IS 'True for national holidays, false for municipal ones such as Santo Antonio in Lisbon.';
COMMENT ON COLUMN psepre_holiday.created_at IS 'Timestamp when the entry was created.';

CREATE UNIQUE INDEX uq_holiday_date_name ON psepre_holiday(holiday_date, name);
CREATE INDEX ix_holiday_date ON psepre_holiday(holiday_date);


-- =====================================================================
-- table dev.psepre_absence_import
-- =====================================================================

CREATE TABLE psepre_absence_import (
    import_id SERIAL PRIMARY KEY,
    filename VARCHAR(256) NOT NULL,
    uploaded_by SMALLINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_count INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (uploaded_by) REFERENCES psepre_app_user(user_id),
    CONSTRAINT ck_absence_import_status
        CHECK (status IN ('PENDING', 'COMMITTED', 'DISCARDED'))
);

COMMENT ON TABLE psepre_absence_import IS 'One spreadsheet upload. Parsing and committing are separate steps, so a PENDING row exists while the user resolves unmatched names and conflicts.';
COMMENT ON COLUMN psepre_absence_import.import_id IS 'Unique identifier of the import.';
COMMENT ON COLUMN psepre_absence_import.filename IS 'Original file name as uploaded, kept so the user can tell two imports apart.';
COMMENT ON COLUMN psepre_absence_import.uploaded_by IS 'User who uploaded the file.';
COMMENT ON COLUMN psepre_absence_import.uploaded_at IS 'Timestamp of the upload.';
COMMENT ON COLUMN psepre_absence_import.row_count IS 'Number of absence rows parsed from the file, including rows that were not committed.';
COMMENT ON COLUMN psepre_absence_import.status IS 'PENDING while awaiting commit, COMMITTED once its rows are written, DISCARDED when abandoned. Discarding removes only the rows it created that were never edited by hand.';


-- =====================================================================
-- table dev.psepre_absence
-- =====================================================================

CREATE TABLE psepre_absence (
    absence_id SERIAL PRIMARY KEY,
    user_id SMALLINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    kind VARCHAR(16) NOT NULL DEFAULT 'VACATION',
    source VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    import_id INT NULL,
    note VARCHAR(256) NULL,
    manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NULL,
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id),
    FOREIGN KEY (import_id) REFERENCES psepre_absence_import(import_id) ON DELETE SET NULL,
    CONSTRAINT ck_absence_period
        CHECK (end_date >= start_date),
    CONSTRAINT ck_absence_kind
        CHECK (kind IN ('VACATION', 'OTHER')),
    CONSTRAINT ck_absence_source
        CHECK (source IN ('IMPORT', 'MANUAL')),
    CONSTRAINT ck_absence_import_reference
        CHECK (source <> 'IMPORT' OR import_id IS NOT NULL)
);

COMMENT ON TABLE psepre_absence IS 'A period a member is unavailable, inclusive of both dates. Imported rows are ordinary editable records, not a read-only snapshot.';
COMMENT ON COLUMN psepre_absence.absence_id IS 'Unique identifier of the absence.';
COMMENT ON COLUMN psepre_absence.user_id IS 'Member who is absent.';
COMMENT ON COLUMN psepre_absence.start_date IS 'First day of the absence, inclusive.';
COMMENT ON COLUMN psepre_absence.end_date IS 'Last day of the absence, inclusive. A single-day absence has start_date = end_date.';
COMMENT ON COLUMN psepre_absence.kind IS 'VACATION for annual leave, OTHER for anything else that makes the member unavailable.';
COMMENT ON COLUMN psepre_absence.source IS 'IMPORT when created by a spreadsheet import, MANUAL when entered in the UI.';
COMMENT ON COLUMN psepre_absence.import_id IS 'Import that created this row. Required when source is IMPORT. Set to null rather than deleting the absence if the import record is ever removed.';
COMMENT ON COLUMN psepre_absence.note IS 'Free text, shown in the absence list.';
COMMENT ON COLUMN psepre_absence.manually_edited IS 'True once an imported row has been edited in the UI. A later import reports such a row as a conflict and leaves it alone, instead of silently overwriting the correction.';
COMMENT ON COLUMN psepre_absence.created_at IS 'Timestamp when the absence was created.';
COMMENT ON COLUMN psepre_absence.updated_at IS 'Timestamp of the last update to the absence.';

CREATE INDEX ix_absence_user_period ON psepre_absence(user_id, start_date, end_date);
CREATE INDEX ix_absence_import ON psepre_absence(import_id);


-- =====================================================================
-- table dev.psepre_plan
-- =====================================================================

CREATE TABLE psepre_plan (
    plan_id SERIAL PRIMARY KEY,
    team_id SMALLINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by SMALLINT NOT NULL,
    published_at TIMESTAMPTZ NULL,
    notes VARCHAR(2000) NULL,
    FOREIGN KEY (team_id) REFERENCES psepre_team(team_id),
    FOREIGN KEY (generated_by) REFERENCES psepre_app_user(user_id),
    CONSTRAINT ck_plan_period
        CHECK (period_end >= period_start),
    CONSTRAINT ck_plan_status
        CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ex_plan_published_no_overlap
        EXCLUDE USING gist (
            team_id WITH =,
            daterange(period_start, period_end, '[]') WITH &&
        ) WHERE (status = 'PUBLISHED')
);

COMMENT ON TABLE psepre_plan IS 'A generated schedule for one team over one period. Drafts may overlap freely; published plans may not, which is what makes the fairness replay safe.';
COMMENT ON COLUMN psepre_plan.plan_id IS 'Unique identifier of the plan.';
COMMENT ON COLUMN psepre_plan.team_id IS 'Team the plan is for.';
COMMENT ON COLUMN psepre_plan.period_start IS 'First date covered, inclusive.';
COMMENT ON COLUMN psepre_plan.period_end IS 'Last date covered, inclusive.';
COMMENT ON COLUMN psepre_plan.status IS 'DRAFT while being reviewed, PUBLISHED once it is the schedule of record. Only PUBLISHED plans feed the fairness ledger.';
COMMENT ON COLUMN psepre_plan.generated_at IS 'Timestamp the plan was generated.';
COMMENT ON COLUMN psepre_plan.generated_by IS 'User who generated the plan.';
COMMENT ON COLUMN psepre_plan.published_at IS 'Timestamp the plan was published, null while it is a draft.';
COMMENT ON COLUMN psepre_plan.notes IS 'Free text rendered under the intro of the generated email, one paragraph per line. Carries what the schedule cannot know by itself: that a day is off because the client has no on-site work, or that a head count is short for a reason worth stating.';
COMMENT ON CONSTRAINT ex_plan_published_no_overlap ON psepre_plan IS 'Two published plans for the same team can never cover the same day. Without this, replaying the ledger would count a day twice and quietly corrupt every balance.';

CREATE INDEX ix_plan_team_period ON psepre_plan(team_id, period_start, period_end);


-- =====================================================================
-- table dev.psepre_plan_day
-- =====================================================================

CREATE TABLE psepre_plan_day (
    plan_day_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    day_date DATE NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    holiday_name VARCHAR(64) NULL,
    required_count SMALLINT NOT NULL DEFAULT 0,
    understaffed BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (plan_id) REFERENCES psepre_plan(plan_id) ON DELETE CASCADE,
    CONSTRAINT ck_plan_day_required_not_negative
        CHECK (required_count >= 0),
    CONSTRAINT ck_plan_day_holiday_name
        CHECK (is_holiday OR holiday_name IS NULL)
);

COMMENT ON TABLE psepre_plan_day IS 'One on-site day inside a plan. Only days matching the team weekday are stored, so the table is the list of Mondays rather than every date in the period.';
COMMENT ON COLUMN psepre_plan_day.plan_day_id IS 'Unique identifier of the plan day.';
COMMENT ON COLUMN psepre_plan_day.plan_id IS 'Plan this day belongs to.';
COMMENT ON COLUMN psepre_plan_day.day_date IS 'The date.';
COMMENT ON COLUMN psepre_plan_day.is_holiday IS 'True when the day fell on a public holiday. Such a day has no assignments and produces no fairness accrual.';
COMMENT ON COLUMN psepre_plan_day.holiday_name IS 'Name of the holiday, copied at generation time so the plan stays readable if the holiday table is later edited. Null unless is_holiday.';
COMMENT ON COLUMN psepre_plan_day.required_count IS 'How many members were actually required that day: the team requirement, or fewer when not enough members were eligible. Zero on a holiday.';
COMMENT ON COLUMN psepre_plan_day.understaffed IS 'True when fewer members were assigned than the team rule asks for. A warning surfaced in the UI, never a generation failure.';

CREATE UNIQUE INDEX uq_plan_day_plan_date ON psepre_plan_day(plan_id, day_date);
CREATE INDEX ix_plan_day_date ON psepre_plan_day(day_date);


-- =====================================================================
-- table dev.psepre_plan_assignment
-- =====================================================================

CREATE TABLE psepre_plan_assignment (
    plan_day_id INT NOT NULL,
    user_id SMALLINT NOT NULL,
    PRIMARY KEY (plan_day_id, user_id),
    FOREIGN KEY (plan_day_id) REFERENCES psepre_plan_day(plan_day_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id)
);

COMMENT ON TABLE psepre_plan_assignment IS 'A member assigned to be on site on a given plan day. The primary key stops the same person being assigned twice to one day.';
COMMENT ON COLUMN psepre_plan_assignment.plan_day_id IS 'Plan day the assignment belongs to.';
COMMENT ON COLUMN psepre_plan_assignment.user_id IS 'Assigned member.';

CREATE INDEX ix_plan_assignment_user ON psepre_plan_assignment(user_id);


-- =====================================================================
-- table dev.psepre_swap_request
-- =====================================================================

CREATE TABLE psepre_swap_request (
    swap_request_id SERIAL PRIMARY KEY,
    requester_id SMALLINT NOT NULL,
    target_id SMALLINT NOT NULL,
    requester_plan_day_id INT NOT NULL,
    target_plan_day_id INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    note VARCHAR(256) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ NULL,
    FOREIGN KEY (requester_id) REFERENCES psepre_app_user(user_id),
    FOREIGN KEY (target_id) REFERENCES psepre_app_user(user_id),
    FOREIGN KEY (requester_plan_day_id) REFERENCES psepre_plan_day(plan_day_id) ON DELETE CASCADE,
    FOREIGN KEY (target_plan_day_id) REFERENCES psepre_plan_day(plan_day_id) ON DELETE CASCADE,
    CONSTRAINT ck_swap_request_two_people
        CHECK (requester_id <> target_id),
    CONSTRAINT ck_swap_request_two_days
        CHECK (requester_plan_day_id <> target_plan_day_id),
    CONSTRAINT ck_swap_request_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_swap_request_resolved
        CHECK ((status = 'PENDING') = (resolved_at IS NULL))
);

COMMENT ON TABLE psepre_swap_request IS 'A proposal by one member to exchange one of their assigned on-site days with a day assigned to another member of the same team. The assignments move only when the other member approves.';
COMMENT ON COLUMN psepre_swap_request.swap_request_id IS 'Unique identifier of the request.';
COMMENT ON COLUMN psepre_swap_request.requester_id IS 'Member proposing the exchange. Taken from the authenticated caller, never from the request body.';
COMMENT ON COLUMN psepre_swap_request.target_id IS 'Member being asked. Only they may approve or reject: an approval is consent, so not even an administrator gives it on their behalf.';
COMMENT ON COLUMN psepre_swap_request.requester_plan_day_id IS 'Day the requester holds and is offering. Deleted with its plan day: if the day is gone, so is the proposal.';
COMMENT ON COLUMN psepre_swap_request.target_plan_day_id IS 'Day the target holds and the requester is asking for. Must belong to a published plan of the same team as the offered day.';
COMMENT ON COLUMN psepre_swap_request.status IS 'PENDING while awaiting an answer, APPROVED once the assignments were exchanged, REJECTED when refused, CANCELLED when the requester withdrew it. Only a PENDING row can change.';
COMMENT ON COLUMN psepre_swap_request.note IS 'Free text from the requester, shown to the target.';
COMMENT ON COLUMN psepre_swap_request.created_at IS 'Timestamp the request was raised.';
COMMENT ON COLUMN psepre_swap_request.resolved_at IS 'Timestamp the request left PENDING. Null exactly while it is pending, which ck_swap_request_resolved enforces in both directions.';
COMMENT ON CONSTRAINT ck_swap_request_two_days ON psepre_swap_request IS 'A swap needs two days. Exchanging a day with itself is a no-op that would still travel through the approval flow.';

CREATE UNIQUE INDEX uq_swap_request_pending
    ON psepre_swap_request(requester_plan_day_id, target_plan_day_id)
    WHERE status = 'PENDING';
CREATE INDEX ix_swap_request_target_status ON psepre_swap_request(target_id, status);
CREATE INDEX ix_swap_request_requester ON psepre_swap_request(requester_id, created_at DESC);

COMMENT ON INDEX uq_swap_request_pending IS 'One pending proposal per pair of days. Resolved rows are history and may repeat, so the uniqueness is partial rather than absolute.';


-- =====================================================================
-- table dev.psepre_auth_token
-- =====================================================================

CREATE TABLE psepre_auth_token (
    token_validation_info VARCHAR(256) PRIMARY KEY,
    user_id SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES psepre_app_user(user_id) ON DELETE CASCADE
);

COMMENT ON TABLE psepre_auth_token IS 'Opaque session tokens issued at login and carried in the authToken cookie.';
COMMENT ON COLUMN psepre_auth_token.token_validation_info IS 'Hash of the token, never the token itself, so a database leak does not hand over live sessions.';
COMMENT ON COLUMN psepre_auth_token.user_id IS 'User the token authenticates.';
COMMENT ON COLUMN psepre_auth_token.created_at IS 'Timestamp the token was issued.';
COMMENT ON COLUMN psepre_auth_token.last_used_at IS 'Timestamp the token was last presented. Drives idle expiry.';

CREATE INDEX ix_auth_token_user ON psepre_auth_token(user_id);

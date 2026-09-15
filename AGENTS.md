# AGENTS.md — pse-presence engineering guide

> **Understand before changing. Reuse before reinventing. Make the smallest change that solves the problem.**

This file is the map of the repository for anyone working on it, human or agent. It
must stay accurate: where this prose and the running code disagree, **the code wins**
and this file is the thing to fix.

**Last verified:** 2026-09-14 (backend complete; web application against it, with
member-to-member day swaps and the pages behind them restricted to administrators;
the férias import commit reporting published plan days that contradict the rows it
applied).

---

## 0. Maintenance protocol

Update this file in the same change that makes it wrong:

1. **Add, remove or rename a table or column** → update §3.
2. **Add, remove or rename an endpoint** → update §4.
3. **Add a service, repository, domain object or error class** → update §2 and §5.
4. **Change the fairness rule or the generator** → update §6. This is the part of the
   system people will question, so it must stay explained.
5. **Change a hard constraint** (language, framework, persistence) → update §1.

---

## 0.1 Known gaps

Deliberate, not oversights. Kept in README.md under "Not done yet" so there is one
place to look: Docker images for the API and web, the spreadsheet parser never having
seen the real file, Active Directory authentication, the seeded development
passwords, health checks beyond the database, and the menu and notifications having
no way to carry a warning.

**User editing is one field wide.** `psepre_app_user` is otherwise seed data: no
create, no edit, no delete of a person, at any layer. The picture is the exception,
because nothing fills it in on its own — Active Directory authenticates and carries no
photographs, so somebody has to upload one. That gave `UserService` its first write
and its first permission rule: **your own picture, or anybody's if you administer the
application**, enforced in the service and mirrored by which buttons Equipa draws.
Editing a name, an email or an admin flag still has no route and no screen; when it is
wanted, the rule above is the one to follow.

**A published plan that contradicts imported férias is reported, not pushed.** The
commit that applies an import names the published days its rows put at odds (§6.3)
and the Plano page marks the person on férias in the row, but the menu and the
notification bell carry nothing, so the warning reaches only whoever is already
looking. Designing those to carry it is deferred and recorded in README.md under
"Not done yet".

## 1. Hard constraints

| Constraint | Value |
|---|---|
| Database | PostgreSQL, schema `dev` |
| API | Kotlin + Spring Boot, package `pt.pse.presence` |
| Persistence | **JDBI**, hand-written SQL. No JPA, no Hibernate, no `@Entity`. |
| Transactions | `transactionManager.run { ctx -> ... }`. **No `@Transactional`.** |
| Web | Vite + React + TypeScript + Tailwind + shadcn/ui |
| Local ports | Web 5273, API 8280, database 5632. Both deliberately off the defaults so this runs beside survey-suite and beside whatever already holds 8080. |
| UI language | **Portuguese.** Code, comments, SQL comments and commit messages in English. |

**Forbidden architectural changes**: hexagonal / ports-and-adapters, CQRS, mediators,
generic managers, use-case classes everywhere, interfaces with a single implementation
added purely for abstraction. A service method is the use case, and a direct
service → repository relationship is the intended shape.

---

## 2. Repository layout

```
pse-presence/
├── AGENTS.md            this file
├── README.md            what it is
├── LOCAL_DEV.md         how to run it
├── docker-compose.yml
├── docker/              dockerfile-db / dockerfile-api / dockerfile-web + scripts/
├── sql/                 001_drop / 002_create / 003_insert - hand-written, numbered
├── jvm/presence/        Gradle root, package pt.pse.presence
│   └── src/main/kotlin/pt/pse/presence/
│       ├── config/          DatabaseConfig, AuthProperties, PipelineConfigurer
│       ├── domain/objects/  User, Team, Holiday, Absence, Plan, SwapRequest
│       ├── infrastructure/security/  AuthProvider, LocalAuthProvider, TokenFactory
│       ├── http/pipeline/   AuthenticationInterceptor, AuthenticatedUserArgumentResolver
│       ├── http/controllers/
│       ├── http/models/     ApiResponse envelope and its builder
│       ├── http/exception/  ExceptionHandlerControllerAdvice
│       ├── repository/      Transaction, TransactionManager (interfaces)
│       ├── repository/jdbi/ Handle-backed implementations
│       ├── services/        + services/error, one sealed error file per service
│       └── utils/           Either, BaseError, ProblemDetails
├── web/                 Vite React SPA
└── design/              design canvas source (build.mjs regenerates the artboards)
```

`sql/` is **not** a migration tool. `002` and `003` run once, when the database
container initialises an empty volume. Changing the schema during development means
dropping the volume and letting it re-run. Once there is data worth keeping, add
numbered forward-only files (`004_...`) and say so here.

There is one: **`004_add_user_avatar_pg.sql`** adds `psepre_user_avatar`, written
forward-only rather than by dropping the volume because there was local work in the
database at the time. `002` carries the table as well, so a fresh volume needs nothing
else, and `004` is `IF NOT EXISTS` so the two cannot collide in either order. Apply it
to a running database with
`docker exec -i pse-presence-db-1 psql -U dbuser -d presenceDB < sql/004_add_user_avatar_pg.sql`.

`psepre_user_avatar` holds the bytes, not a URL, and sits apart from `psepre_app_user`
rather than adding columns to it. Nothing else in the company serves these pictures —
Active Directory authenticates and carries no photographs — so a URL column would have
pointed at nowhere. Apart, because every query about a person selects the user row and
none of them want an image: kept together, the bytes would travel to the calendar, to
every plan and to every roster to be thrown away. What the user queries do take is a
left join for `updated_at` alone, aliased `avatar_version`.

---

## 3. Database conventions

- Schema `dev`. Every object is created with `SET search_path TO dev;` at the top of
  the file.
- Tables are prefixed `psepre_`. **Deliberate deviation:** survey-suite splits its
  prefix into `psestr_` (master) and `psestf_` (transactional), but applies the split
  inconsistently — `psestr_app_user` is master data while `psestf_client_custom_url_domain`
  is configuration. Rather than import that ambiguity, every table here uses one prefix.
- Timestamps are `TIMESTAMPTZ`, defaulting to `CURRENT_TIMESTAMP`. Calendar facts
  (`joined_at`, `start_date`, `day_date`, `fairness_since`) are `DATE`, because a
  vacation day is a date, not an instant, and must not shift with a timezone.
- **Every table and every column gets a `COMMENT ON`.** No exceptions.
- Naming: indexes `ix_`, unique indexes `uq_`, check constraints `ck_`, exclusion
  constraints `ex_`.
- Enumerated values are `VARCHAR` plus a `CHECK`, not a Postgres `ENUM` type and not a
  lookup table. They are small, closed and read from Kotlin as strings.
- A rule that binds only rows in one state is a **partial unique index**, not a check
  in the service. `uq_swap_request_pending` refuses a second pending proposal for the
  same pair of days while leaving resolved rows free to repeat, which no application
  check can promise under two concurrent requests.
- Weekdays are **ISO-8601**: 1 = Monday through 7 = Sunday. This matches
  `java.time.DayOfWeek.getValue()` and Postgres `EXTRACT(ISODOW FROM ...)`, so the
  same integer means the same day on both sides. Do not use Postgres `DOW`, which is
  0 = Sunday.

---

## 4. API conventions

Base prefix `/api/v1`. Every success response is an `ApiResponse<T>` envelope
(`data` list plus a timestamp), `application/json`. Every failure is an RFC 7807
`ProblemDetails`, `application/problem+json`, with Portuguese messages.

Services return `Either<SealedError, Value>` and **never throw** business exceptions.
Controllers translate the `Either` into a response and contain no business logic.

A route is authenticated by declaring an `AuthenticatedUser` parameter (§6.1). The
**auth** column below marks routes that do, and **admin** marks those whose service
additionally checks `isAdmin`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/status` | none | version plus a real database round trip |
| POST | `/auth/login` | none | sets the `authToken` cookie |
| POST | `/auth/logout` | auth | deletes the session |
| GET | `/auth/me` | auth | current user |
| GET | `/users` | auth | everyone schedulable, the same names every plan shows |
| GET | `/users/{id}/avatar` | auth | **the one route that does not answer in the envelope**: it answers `image/*` bytes, because an `<img>` is on the other end. Failures are still ProblemDetails. Cached immutably — the address carries the version |
| POST | `/users/{id}/avatar` | auth | multipart. Own picture, or anyone's when admin. Type sniffed from the bytes, 2 MB cap on the upload, then **re-encoded to a 128px PNG before storing** — the dashboard draws hundreds of marks at 13px and each was the whole file somebody uploaded |
| DELETE | `/users/{id}/avatar` | auth | same rule |
| GET | `/teams` | auth | active teams |
| GET | `/teams/{id}` | auth | |
| GET | `/teams/{id}/members` | auth | includes leavers, which the generator needs |
| GET | `/teams/{id}/candidates` | auth | active users not on the team |
| POST | `/teams` | admin | |
| POST | `/teams/{id}/members` | admin | |
| DELETE | `/teams/{id}/members/{userId}` | admin | sets `left_at`, never deletes history |
| PATCH | `/teams/{id}` | admin | name, weekday, required count, `fairness_since`. The name is optional and checked for a clash, the other three are not optional |
| PATCH | `/teams/{id}/email` | admin | the subject and opening paragraph every message for the team starts from. Saved from the email page, which is where anybody has both the words and a reason to keep them |
| GET | `/holidays?year=` | auth | |
| POST | `/holidays/generate?year=` | admin | idempotent, existing rows untouched |
| DELETE | `/holidays/{id}` | admin | |
| GET | `/absences?userId=&from=&to=&source=` | auth | every filter optional |
| POST | `/absences` | auth | own, or anyone when admin |
| PATCH | `/absences/{id}` | auth | own or admin; marks `manually_edited` |
| DELETE | `/absences/{id}` | auth | own or admin |
| GET | `/absences/imports` | auth | upload history |
| POST | `/absences/imports` | admin | multipart, returns a preview, writes no absence |
| POST | `/absences/imports/{id}/commit` | admin | applies the reviewed rows, and reports any published plan days they contradict (§6.3) |
| DELETE | `/absences/imports/{id}` | admin | removes only the rows it created and nobody edited |
| GET | `/teams/{id}/balance` | auth | the fairness ledger, from published plans only |
| GET | `/plans?teamId=&year=` | auth | summaries, without days |
| GET | `/plans/{id}` | auth | with days and assignments |
| POST | `/plans/generate` | admin | creates a DRAFT. Optional `pinnedUserIds` / `excludedUserIds` — see §6 |
| POST | `/plans/{id}/publish` | admin | 409 when it overlaps a published plan |
| PATCH | `/plans/{id}/days/{date}` | admin | replaces a whole day |
| PATCH | `/plans/{id}` | admin | the notes carried into the email |
| DELETE | `/plans/{id}` | admin | |
| GET | `/plans/{id}/email` | auth | the Portuguese message, html and text |
| POST | `/plans/{id}/email` | auth | the same message in the sender's words, and only the months they send. Stores nothing |
| GET | `/swaps` | auth | mine, received and sent together |
| POST | `/swaps` | auth | proposes an exchange, moves nothing |
| POST | `/swaps/{id}/approve` | auth | the target only, and this is what applies it |
| POST | `/swaps/{id}/reject` | auth | the target only |
| DELETE | `/swaps/{id}` | auth | the requester, or an admin, while pending |

---

## 5. Layer rules

| Layer | May do | Must not do |
|---|---|---|
| `http/controllers` | orchestrate `when (result)`, map to DTO | business logic, SQL |
| `services` | orchestration, transactions, permission checks | know about `HttpStatus` or `ResponseEntity` |
| `domain` | pure logic and validators | touch repositories, return `Either`, catch exceptions |
| `repository/jdbi` | SQL via `Handle` | business decisions |

Request bodies live in `http/models/<feature>/*InputModels.kt`, responses in
`*OutputModels.kt`. Column names come from `*DbModel` accessors, never as string
literals inside a query.

---

## 6. The fairness rule

This is the part of the system people will argue about, so it is written down.

**Members are picked by debt, not by count.** On every on-site day, each member who
was actually available accrues a claim of `required / eligible` (with three members
and two slots, 2/3 of a day each). Being assigned adds 1. The generator picks whoever
has the largest `expected - assigned`.

Why not simply count assignments and pick the lowest:

- Someone who joins in June would show a permanently lower count and be picked every
  single week until they caught up on Mondays they were not even employed for.
- Someone returning from three weeks of vacation would be punished the same way.

Under the debt rule, an absent member accrues nothing that day, so they are neither
penalised for being away nor owed the day back. A new member accrues only from their
`joined_at`, so they open at zero debt and converge with everyone else.

`PlanGenerator.generate` and `PlanGenerator.replay` share the accrual rule by
construction. If they drifted apart, a plan generated with a carried balance would
disagree with the ledger the team is shown and neither would obviously be wrong.
`replay` uses the `required_count` stored on each day rather than the team's current
rule, so changing the rule does not rewrite history.

**Two exceptions may be asked for when generating, and neither is stored.** They are
arguments to `POST /plans/generate`, not settings: regenerate without them and the plan
is exactly what the rule gives on its own.

- **Fixed** (`pinnedUserIds`) takes a slot on every day, and the debt rule fills what
  is left. A fixed member **stays inside the ledger** — accruing their share and paying
  it off by being assigned — which is what avoids a second accrual rule. The
  consequence was chosen deliberately and is covered by a test: being on every day
  earns far more than the share it pays for, so a fixed member's saldo runs negative
  for as long as they are fixed, and everybody else's runs positive because they share
  fewer free slots against the same accrual. Fix somebody for a quarter and the Balanço
  will say so.
- **Excluded** (`excludedUserIds`) is not scheduled, but **stays eligible**, so they go
  on accruing and are simply never chosen: missing a turn leaves them owed it and the
  next plan gives it back. That is the only reading under which `generate` and `replay`
  still agree, because replay cannot know a plan excluded anybody — what it sees is a
  member who was available and was not assigned, which is exactly this.
- For somebody genuinely unavailable — a secondment, a long course — **an absence of
  kind OTHER is the right tool**, and the only one that stops the days accruing at all.
  Both halves already honour it. Excluding is for skipping a turn, not for being away.
- Asking for both at once is refused (`PlanError.PinnedAndExcluded`) rather than
  letting one silently win.

**Drafts may overlap, published plans may not.** Overlapping drafts are the review
workflow. Publishing is what feeds the ledger, and the exclusion constraint on
`psepre_plan` refuses an overlapping publish; `PlanService.publish` catches SQLSTATE
23P01 and turns it into a sentence rather than a 500.

**A swap moves debt and nothing else.** Two members exchanging two published days is a
targeted `UPDATE` of the assignment row (`PlanRepository.reassign`), never
`replaceAssignments`, which recomputes `required_count` from the list it is handed.
With `required_count` and the eligible set untouched, `replay` derives an identical
`expected` for everyone and moves exactly one unit of `assigned` from one member to the
other. The ledger absorbs the exchange with no bookkeeping, which is the point of
deriving it rather than storing it.

That is also why the member **taking on** a day must be in the team on that date and
must not be away. `replay` accrues `expected` only for members who were eligible, so a
day taken on while absent is credited with no matching accrual: their debt falls by one
and no future plan can ever give it back. `SwapValidator` refuses both cases, and the
rule is ledger integrity rather than politeness.

**Only published days may be swapped.** Drafts overlap by design, so a date does not
identify a day for a team; a draft is a proposal with nothing settled to trade; and an
administrator regenerating one would silently discard an agreement two people made.
`PATCH /plans/{id}/days/{date}` stays the way to edit a draft.

**The ledger is derived, never stored.** Opening balances are replayed from the
`PUBLISHED` plan days at or after `psepre_team.fairness_since`. There is no counter
column, so the ledger cannot drift away from the plans it describes. An exclusion
constraint on `psepre_plan` guarantees two published plans for one team can never
cover the same day, which is what makes the replay safe.

---

## 6.1 Authentication

Login verifies credentials through an [AuthProvider], selected by `auth.provider`.
The provider only answers "are these credentials correct". Looking the user up,
issuing the token and setting the cookie stay in `AuthService`, so adding Active
Directory means writing one class, not editing the login flow.

**A route is protected by asking for the caller.** `AuthenticationInterceptor` fires
only when the handler declares an `AuthenticatedUser` parameter. There is no list of
protected paths to keep in sync, and no way to leave a route open by forgetting to
add it to one: if a handler wants to know who is calling, it is authenticated.

**The database never holds a usable token.** `TokenFactory` issues 32 bytes of
`SecureRandom` as unpadded Base64URL and stores only the SHA-256. BCrypt would be
wrong here and SHA-256 is right: the input is already 256 bits of randomness rather
than a guessable password, so there is nothing to slow an attacker down against, and
every authenticated request needs one indexed lookup.

Unknown username and wrong password return the same error, deliberately, so nobody
can use the login form to enumerate accounts. `LocalAuthProvider` also runs a BCrypt
comparison against a dummy hash when a user has no local password, so the two cases
cannot be told apart by response time either.

Authorization is not done here. The interceptor establishes *who* is calling;
whether they may do a thing is checked in the service, next to the rule it enforces.

## 6.2 Three things that bite in this codebase

**Never swallow an exception silently.** Service bodies run inside `guarded(log,
"Service.method", SomeError.DatabaseError) { ... }` from `utils/Guard.kt`. A bare
`catch (e: Exception) { failure(...) }` returns a clean 500 and leaves nothing to
debug, which cost real time here already: an absence query failed in production
shape with no trace of why until the logging went in.

**A returned failure commits.** `transactionManager.run` is `jdbi.inTransaction`, which
rolls back on a thrown exception and on nothing else. Every service that reads and then
makes a single write is safe by accident. One that makes two, as approving a swap does,
is not: returning `failure(...)` between them commits the first write. Validate before
writing, and when a write that was already validated comes back false, **throw**.
`guarded` logs it and returns the failure, and JDBI rolls the transaction back. Half an
applied swap would put one person on both days and the other on neither, and the ledger
would be wrong for two people with nothing recording why.

**Cast optional query parameters.** Postgres cannot infer the type of a null
parameter that only appears in `:param IS NULL`, and rejects the whole statement
with "could not determine data type of parameter". Any filter that may be null must
be written `CAST(:param AS INT) IS NULL OR col = CAST(:param AS INT)`. See
`JdbiAbsenceRepository.find`.

## 6.3 Importing the vacation spreadsheet

Two layouts are accepted, and the file says which it is by its own shape.

**The grid is what the team actually keeps** (`AbsenceGridParser`): a year as four
quarter blocks, three months side by side in each, one column per day, one row per
person, and a mark on every day somebody is away. There is no start or end date
anywhere in it. A period exists only as a run of adjacent marks, so the parser reads
column by column and collapses runs afterwards.

Two things in that layout are easy to get wrong and were:

- Months run left to right within a block, and the last block carries a January
  *after* its December, belonging to the next year. The year rolls forward when a
  month number drops relative to the column before it. Comparing against the block's
  largest month instead dated that block's October and November a year late, which a
  test caught.
- A person's absence can span two blocks, September into October. Marks are gathered
  per person across the whole sheet and only then collapsed into periods; collapsing
  per block would split that absence in two.

**A list of Nome, Início and Fim** is also read (`AbsenceSheetParser.parseColumns`),
because it is the obvious thing somebody exports when asked for one. Its headings are
configuration (`absence.import.*`) and it finds columns by heading rather than
position, so inserting a column upstream does not shift every date by one.

**Nothing is dropped silently.** A row that cannot be read is rejected with a reason
and its line number. A vacation quietly lost here becomes somebody scheduled to be
in the office while they are away, which is exactly the failure this project exists
to prevent.

**Dates are read day first** in the list format. The sheet is Portuguese, so 03/08 is
3 August. Reading it month first would be wrong by five months and look entirely
plausible.

**Weekend marks are kept.** The grid's own day totals at the foot exclude weekends
and count carry-over from the previous year; they are an HR figure and will not match
what this reads. That is fine: the generator only ever asks whether somebody is
available on a given date.

Upload and commit are separate. The upload parses and reports; it writes a PENDING
import row and changes no absence. Commit re-runs the reconciliation against the
database as it is at that moment: what the browser was shown is a suggestion, not an
instruction, and the preview may be minutes old.

Reconciliation has no identifier to work with, since the sheet carries none. The
rules, in `ImportReconciler`:

| Situation | Outcome |
|---|---|
| No import-owned row overlaps | `NEW`, inserted |
| An identical row exists | `UNCHANGED` |
| An overlapping import-owned row, dates differ | `UPDATE` |
| The same, but the row was hand edited | `CONFLICT`, left alone unless chosen |
| The name matched nobody | `UNMATCHED`, needs a mapping |
| A previously imported row this file omits | reported as missing, **never deleted** |

Two rules that are easy to get wrong and were:

- `updateFromImport` must not touch `import_id`. That column records which import
  *created* the row. Reassigning it to whichever import last moved the dates makes a
  later discard delete a row an earlier file was responsible for, which lost a real
  vacation during testing.
- An import must never call `AbsenceRepository.update`, which sets
  `manually_edited`. Doing so would stamp every touched row as hand edited and the
  next import would then refuse to update any of them.

**Commit also reports the published days the applied rows contradict.** A published
plan is a snapshot of the absences known when it was generated, so applying a férias
import afterwards can leave it putting somebody on a day they are now away. The
commit answer carries those days as `conflicts` in `CommitReport`, worked out by
`PlanConflictFinder` from the published assignments over the applied rows' dates.
Every applied row counts, including an UNCHANGED one: the dates stay in place
whichever file put them there, and a published plan contradicting them is news
either way. The plan is never rewritten. It was already emailed, and a rotation
reshuffled behind the team's back could not be trusted; the report names the day
and editing it is the administrator's decision. The conflicts are computed from the
assignments as they stand, so an import re-run after the day has been fixed reports
nothing.

## 7. Writing rules

These bind **UI copy, code comments, SQL comments, documentation and commit
messages**. They are not stylistic preferences; treat a violation as a defect.

- **No emoji.** Anywhere. Not in the UI, not in commit messages, not in docs.
- **No em dashes or en dashes** (`—`, `–`) in text you write. Use a comma, a full
  stop, a colon, or restructure the sentence.
- **Labels are labels.** A button says `Gerar`, not `Gerar plano de trabalho
  presencial`. A column header says `Data`, not `Data da presença no escritório`. If a
  label needs a sentence to be understood, the layout is wrong, not the label.
- **No filler words.** Drop "simply", "just", "easily", "powerful", "seamless",
  "robust", "comprehensive".
- **Errors state the fact and the fix.** `Ficheiro sem coluna de datas.` not
  `Ocorreu um erro ao processar o seu ficheiro.`
- **Portuguese for everything the user reads.** English for code, identifiers,
  comments, SQL comments and commit messages.

---

## 8. Front end conventions

- **Never hand-roll a component that exists in `src/components/ui/`.** shadcn/ui is
  present precisely so that every button, table and dialog comes from one variant
  system.
- **Never write a literal colour in a component.** Use the tokens. A hardcoded hex is
  a bug: it will be wrong in one of the two themes. Identity colour is the exception
  and it lives in `lib/utils.ts`, not in a component: `memberColour(id)` turns the hue
  by the golden angle so that any number of people come out as far apart as they can
  get. It replaced a six-entry list, which put seven people in the same colour on a
  forty-person roster and made every colour-coded surface say nothing.

- **A box of people draws itself by density, not by truncation.** `density(n)` in
  `lib/utils.ts` returns `names` up to four, `marks` up to twelve, `count` beyond that,
  and each of the three is a whole answer at the size it is used. Naming three of forty
  and appending `+37` is not a smaller list, it is a list that has stopped working. A
  cell with two commitments on it draws one line per commitment, each at its own
  density: two shortened lists stacked printed anybody on both rosters twice.
- Themes are `:root` and `html[data-theme='dark']` over the same token names. Dark is
  the default. Light must work; check both before calling anything done.
- Motion is entrance only, one easing curve, and always disabled under
  `prefers-reduced-motion`. Nothing in the application loops **except one thing, and
  it is the wait**: `components/ui/orb.tsx`, over `thinking-orbs`. Every caller goes
  through it and there are three — GERAR, PUBLICAR, and the email page composing its
  preview. They are the waits with no shape: one button, nothing coming to lay out,
  and only the question of whether it is still going. Where there *is* a shape coming,
  the answer is still a skeleton holding the row heights, and always will be. The orb
  is a canvas, so no stylesheet reaches it: it reads `prefers-reduced-motion` itself
  and freezes, the way `SwapDialog` does. It also takes `onAccent` — the library draws
  light ink for a dark ground and dark ink for a light one, and this application's
  accent is white on the dark theme, so an orb inside a filled button wants the
  opposite of the page around it.
- **Modals.** Every one comes from `components/ui/dialog.tsx`; there is no second
  modal in the application. The primitive owns three things so that ten callers do not
  each decide them: the entrance, the centring, and the resize. Its body carries a
  layout animation, so a modal whose contents change size — the bell as swaps are
  answered, a stepped form moving between questions — moves its own edge instead of
  snapping to a new one. Material calls that a container transform, and it is the
  whole of what "the modal is dynamic" means here.

  What a modal is **not** is a wizard by default. Of them, one asks a sequence of
  questions and is stepped; the rest are a confirmation, a form, or a list, and
  breaking any of those into steps would add clicks to buy nothing. The test is
  whether a later question is narrowed by an earlier one. Widths go 460 (confirm),
  520 (list), 560 (form), 660 (stepped).

  **A choice worth seeing answered is a page, not a modal.** Gerar and the plan's
  email are both: each asks a handful of questions whose answer — the plan that would
  be stored, the message that would be sent — has to sit beside them while they are
  being asked. A modal has no room for that and no way to stand next to it, so the
  choice gets made blind and reviewed afterwards.

  **Beside, and for a filter, on top.** The email page asks two kinds of question and
  draws them in two places. The words being written are a column of their own; the
  months and the three switches, which only decide how much of the message is there,
  are a bar along the top of the preview. They were a second card under the writing,
  and the two together were taller than the column they stood in, so the sentence being
  typed and the months it would carry were never on screen at once. A filter belongs on
  the edge of what it filters.

  It also opens on **the months still to come** — this year, from this month, the
  running month included — rather than on everything the plan covers. A plan is
  generated three or four months at a time and read in the middle of them; months
  already past and next year are one click away and not the first thing anybody sees.
  A plan with nothing still to come opens whole, or it would open on nothing at all.

  The page is drawn for a send it cannot do yet. `PARA` and `ENVIAR` are there and
  disabled, in the compose window's own places — the field above the greeting, the
  primary slot in the action bar — because the plan is meant to go out on its own one
  day. Nothing behind them exists: no mail in the API, no recipient on a team. See
  README.md under "Not done yet".

- **One exception to entrance-only motion, and it is a shape rather than a decoration:
  a form that asks its questions one at a time may move between them.** `SwapDialog`
  is the case. It asks which day is given up, then who takes it, then which day comes
  back — the day first because that is the answer the reader arrives holding, whether
  they came from a calendar cell or from the button, so a day picked on the calendar
  is an answer to the first question rather than a guess to be honoured later. Its
  three questions used to stand stacked, which was readable while the people were six
  chips and became seven hundred pixels of one question at forty, with the other two
  below the fold of a form nobody had answered yet. Asking them one at a time means the
  reader has to be told where they are, and motion is what tells them: the steps slide
  the way they are travelling and the dialog resizes under them, so it reads as one
  form progressing rather than three dialogs replacing each other. Material's names
  for the two halves are a forward-and-backward transition and a container transform.
  The durations follow theirs, 250–400ms; the curve is this project's own, because
  there is still only one. `motion/react` drives it, so, like `BorderBeam`, it opts
  out of reduced motion itself rather than relying on the CSS rule.
- The sign in screen is the one exception, and it stops at its edge: the ground plane
  drifts and breathes. It is the only screen with no data to show and nothing to
  interrupt. A light used to travel the border of the window as well — `BorderBeam`,
  from Magic UI — and it was removed: on the one screen that is nothing but four
  fields, a second moving thing was one too many.
- Loading is skeletons that hold the real row heights, so content never jumps. A
  blocking overlay is only for generating and publishing a plan.
- Icons are `lucide-react`. No emoji, no icon fonts.
- **A control has to hold the largest case, not the one in front of you.** The months
  on the email page were switches — a tree, then a connected run of segments, one per
  month — and both read well at four months and were a wall at sixteen: the AT plan
  runs into the following year and drew twelve segments for a year nobody was sending,
  wrapping the bar onto a second row to do it. A wall of buttons is not a bigger
  version of four buttons; it is a worse control. So the run collapsed to a summary
  that opens a panel, and the bar is one row whether the plan is four months or forty.
- **A continuous choice is a range, and there is one way to draw one here.**
  `components/ui/date-range.tsx` decided it for the period a plan covers, and
  `month-range.tsx` follows it to the class: presets first because they answer most of
  it, the grid under them, the two ends filled with the accent and the middle in
  `accent-wash`, and what is out of bounds drawn and dead rather than left out. The
  same gesture must not look like two different gestures a page apart.
- **`components/ui/popover.tsx` is the third surface**, after the dialog and the hover
  label, and it is for the choice too big for the bar it lives in and too small to stop
  the page for. It is deliberately not modal: on a page whose whole point is that the
  answer stays visible while the question is asked, a modal would cover the answer.
- The UI primitives in `src/components/ui/` are written here rather than pulled in
  by the shadcn CLI. The CLI brings its own token vocabulary (`--background`,
  `--foreground`); adopting it would have meant maintaining two palettes and
  reconciling them on every component. The value of shadcn is the variant system and
  owning the source, and both survive.
- **One component draws a person: `components/ui/avatar.tsx`.** Every mark in the
  application goes through it — the sidebar, the tables, the calendar cells, the swap
  chips, `AvatarCircles`. It was fifteen call sites each spelling out their own
  initials over their own `memberColour`, which is exactly why a photograph was
  impossible: it would have had to be added to all fifteen, and the one that was
  missed would have gone on drawing letters for somebody who has a face. `avatarUrl`
  is null for everybody today, so the initials are the ordinary case and the colour is
  drawn underneath either way — an image that fails to load leaves the mark it was
  covering rather than a hole. Size comes from the caller's classes, because the sizes
  are not a scale: they are what each surface had room for.
- Magic UI components are **ported by hand into these tokens, never pasted**. One is
  in: `AvatarCircles`. Its source is plain Tailwind v3, but it hardcodes `bg-black` /
  `dark:bg-white` and takes image URLs, so a paste would be the wrong colour in one
  theme and would model a person this application has no way to supply. `BorderBeam`
  was the other, and its upstream needed v4 utilities that compile to nothing here —
  worth remembering, because that failure is silent. Two questions before copying
  anything: does it compile on v3, and does it spend colour this palette does not own?
- Magic UI is **not a dependency and cannot be one** — there is no `magicui` package on
  npm. It is a shadcn *registry*: each component is a JSON file carrying its own source
  (`magicui.design/r/<name>.json`), which the CLI copies into the repo. Since §8 already
  rules out that CLI, the way in is to read the registry JSON and write the component
  here. Most of the library is landing-page decoration that loops, which the motion rule
  forbids outright, so expect to take very little from it. `AvatarCircles` is also the
  one place that knows whether a person has a picture or only initials; everywhere
  else asks it for a row of people.
- State is `useAsync` plus React context. No query library: a handful of screens with
  no shared cache to invalidate does not need one, and reload-after-write is honest
  about what the server actually holds.
- The dev server proxies `/api`, so the browser stays on one origin. With
  `SameSite=Strict` a cross-origin setup would silently drop the session cookie.

---

## 9. Reuse before creating

Before adding a utility, mapper, validator, service, error class or query helper,
search for an existing one. Specifically, do not create a second `Either`, a second
`TransactionManager`, a second response envelope, a parallel error catalogue or a
second date-formatting helper. Extend the existing pattern instead.

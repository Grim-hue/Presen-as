# Local development

## Requirements

Docker with Compose. Node 22+ and a JDK 25 toolchain come in later, with the web and
API steps.

## Database

```bash
docker compose up -d --build db
```

First start creates the volume, then runs `sql/002_create_tables_pg.sql` and
`sql/003_insert_into_tables_pg.sql`. Later starts reuse the volume and run neither.

| | |
|---|---|
| Host port | `5632` (5432 inside the container) |
| Database | `presenceDB` |
| Schema | `dev` |
| User / password | `dbuser` / `potatoes` |

Port 5632 is deliberate: survey-suite already takes 5532, so both can run at once.

Open a shell on it:

```bash
docker compose exec db psql -U dbuser -d presenceDB
```

### Changing the schema

`sql/` is not a migration tool. `002` and `003` only run against an empty volume, so
editing them has no effect on a database that already exists. To pick up a change:

```bash
docker compose down -v && docker compose up -d --build db
```

That destroys the data. Once there is data worth keeping, switch to numbered
forward-only files (`004_...`) and record that in AGENTS.md.

To rebuild the schema in place without dropping the volume, run `001_drop_tables_pg.sql`
followed by `002` and `003` by hand. `001` is not copied into the image on purpose.

### Signing in

The seed creates three users with local passwords, all `presencas`:

| Username | Role |
|---|---|
| `andre.freitas` | administrator |
| `tiago.sousa` | member |
| `joao.vieira` | member |

Local only. Replace the hashes or move to the Active Directory provider before
anything is deployed.

## API

```bash
cd jvm/presence
./gradlew build
java -jar build/libs/presence-0.1.0.jar
```

Listens on **8280**, not 8080. Another JVM on this machine already holds 8080, and the
clash fails at boot in a way that looks like the app returning a bare 404 when it is
really the other process answering. Deployed environments keep the 8080 default.

Check it is actually talking to the database, rather than merely running:

```bash
curl -s localhost:8280/api/v1/status
```

A healthy response is `200 application/json` with `databaseReachable: true` and the
Gradle build version. With the database stopped the same endpoint returns
`503 application/problem+json`, which is the failure path working, not a crash.

### Signing in from the command line

```bash
curl -s -c /tmp/cj -X POST localhost:8280/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"andre.freitas","password":"presencas"}'
```

Then reuse the jar: `curl -s -b /tmp/cj localhost:8280/api/v1/auth/me`.

## Web

```bash
cd web
npm install
npm run dev
```

Opens on **5273**. It proxies `/api` to the API on 8280, so the browser stays on one
origin and the session cookie is first party: with `SameSite=Strict` a cross-origin
setup would have the browser drop it on every request.

Sign in with any seeded user, all with the password `presencas`:

| Username | Role |
|---|---|
| `andre.freitas` | administrator |
| `tiago.sousa` | member |
| `joao.vieira` | member |

The API must be running first, or the login will report that it could not reach the
server, which is the correct message rather than a hung spinner.

## Design canvas

The artboards under `design/` are generated, not hand-edited:

```bash
node design/build.mjs
```

That rewrites every `*.dc.html`. Re-seeding and publishing the canvas is a separate
step, documented in the design skill rather than here.

## Checking the database is sane

Tables, seeded rule, and the holidays that actually collide with the on-site weekday:

```bash
docker compose exec -T db psql -U dbuser -d presenceDB -c "SET search_path TO dev; SELECT h.holiday_date, h.name FROM psepre_holiday h, psepre_team t WHERE EXTRACT(ISODOW FROM h.holiday_date) = t.on_site_weekday ORDER BY 1;"
```

For 2026 that returns exactly one row, 5 October, which is why the plan for September
and October leaves that Monday empty.

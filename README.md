# pse-presence

**PPI — PSE Presenças nas Instalações.**

Planeamento das presenças da development team nas instalações da PSE.

Two of the three team members must work from the PSE office every Monday. This app
holds the plan for the whole year, imports vacations from the company spreadsheet,
generates a fair rotation that skips holidays, and produces the Portuguese email
table to paste into Outlook.

## What it does

- **Plan** — generates every on-site day in a period, skipping Portuguese holidays
  and anyone on vacation, and flags days that cannot be staffed.
- **Fairness** — picks whoever is owed the most office days rather than whoever has
  been fewest times, so someone who joins mid-year is never asked to catch up on
  Mondays they were not employed for. See §3.1 of the plan.
- **Vacations** — imported from an `.xlsx` and then editable like any other record.
  A re-import flags rows you edited by hand instead of overwriting them.
- **Email** — renders the exact table format the team lead expects.

## Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 16, schema `dev`, tables prefixed `psepre_` |
| API | Kotlin + Spring Boot, JDBI (no JPA), package `pt.pse.presence` |
| Web | Vite + React + TypeScript + Tailwind + shadcn/ui + lucide-react + thinking-orbs |
| Auth | Local users now, behind a provider interface so AD/LDAP drops in later |

## Layout

```
docker/     container definitions
sql/        numbered schema and seed files, run by the db container on first boot
jvm/        Gradle project (Kotlin/Spring Boot API)
web/        Vite React SPA
design/     design canvas source; rebuild with `node design/build.mjs`
```

## Running it

See [LOCAL_DEV.md](LOCAL_DEV.md).

## Not done yet

Recorded here so none of it depends on somebody remembering.

**Docker packaging.** Deprioritised, not forgotten. `docker/dockerfile-db` and the
compose file exist and run the database; `dockerfile-api` and `dockerfile-web` do
not. Until they do, the API and the web application are started by hand as
LOCAL_DEV.md describes, which is fine for development and not enough to deploy.

**Active Directory authentication.** `AuthProvider` exists precisely so this is one
new class rather than a change to the login flow, and the parameters are documented
in the pse-site sibling project. Nothing has been written against a real directory.

**The seeded passwords must not survive a deployment.** All three users share
`presencas`, which is flagged in the column comment, the seed file and LOCAL_DEV.md.
Either set real hashes or switch `auth.provider` before this leaves a development
machine.

**Only the database has a container health check.** Once the API and web images
exist they need one too, or a compose start will report success while the stack is
not actually serving.

**A published plan that contradicts imported férias is reported, not pushed.** A
published plan is a snapshot of the absences known when it was generated, so
importing férias afterwards can leave it putting somebody on a day they are now
away. That happened in development: the plan was generated before the sheet was
committed and published after it, and nothing said so until somebody happened to
see both. The import commit now names those days and the Plano page marks the
person in the row, but the warning only reaches whoever is already looking at
those screens. The menu and the notification bell carry nothing, so the
contradiction can still sit unnoticed by everyone else. The menu and
notifications are to be designed later; carrying these contradictions to whoever
can fix the plan is part of that work.

**The email is copied, not sent, and nothing generates on its own.** The plan's
message is rendered by the API and put on the clipboard for Outlook. There is no
mail in the API and no recipient stored against a team, so nobody can be sent
anything from here. The email page already carries `PARA` and `ENVIAR`, drawn and
disabled, because the intent is that a plan is eventually generated and sent
without anybody opening the page; what is missing behind them is a recipient list
on the team, something that speaks SMTP, and whatever decides when a send is due.

## Working on it

See [AGENTS.md](AGENTS.md) before making changes. It carries the conventions this
repo follows and the writing rules for anything user-facing.

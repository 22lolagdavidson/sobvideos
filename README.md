# Open Enrollment Studio

Open enrollment for small-group health insurance (2–50 employees), built for **Davidson Solutions**.
Brokers set up employer groups and plans, upload each plan's SBC, and the app turns it into a short
cartoon explainer video hosted by Penny (a piggy bank) and Patch (a bandage). Employees watch it while
they choose a plan.

- Full build spec: [`docs/SPEC.md`](docs/SPEC.md)
- UX/copy/character reference: [`prototype/index.html`](prototype/index.html) (open it in a browser)

> Status: **step 3 of 6** (employee wizard, elections, dashboard, CSV export). The full README (worker, deployment)
> lands in step 6.

## Quick start (local)

```bash
cp .env.example .env              # then set AUTH_SECRET / NEXTAUTH_SECRET (npx auth secret)
docker compose up -d              # PostgreSQL on localhost:5432 (or use your own and edit DATABASE_URL)
npm install
npm run db:migrate                # applies prisma/migrations
npm run db:seed                   # demo agency, group, 2 plans, 5 employees, 2 elections, 1 approved explainer
npm run dev                       # http://localhost:3000
```

Sign in with a magic link. With `EMAIL_SERVER` empty, emails are written to `storage/dev-outbox/` and
listed at <http://localhost:3000/dev/outbox>, so you can click the link there.

| Demo account | Role |
| --- | --- |
| `broker@example.com` | Broker admin (Davidson Solutions) |
| `hr@example.com` | Employer admin (Maple Street Bakery) |
| `alex.rivera@example.com` (and 4 others) | Employee |

Sign-in is invite-only: an email works only if it belongs to a user or to an eligible employee on a roster.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm test` | Vitest unit tests (tier logic, cost math, participation, number check) |
| `npm run typecheck` / `npm run lint` | Type check / ESLint |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma migrations, demo seed, full reset |

## Layout

```
prisma/schema.prisma        data model (Postgres)
prisma/seed.ts              demo data; seed-data/ holds a demo SBC and its approved script
src/auth.ts                 Auth.js v5: email magic links, database sessions, roles
src/lib/authz.ts            server-side permission checks; every group query is scoped by agency/group
src/lib/domain/             business rules: tier, cost math, participation, enrollment window
src/lib/explainer/          script schema (Zod) and the SBC number check
src/lib/mail.ts             SMTP mail, or the dev outbox
src/lib/audit.ts            audit log writer
```

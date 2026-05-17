# HK ENV. WEB-APP

A browser-based operations platform for **HK Environmental Group** — haul/trucking dispatch, GPS trip tracking, digital load ticketing, project budgets, owner exception approvals, and role-based access for Owners, Admins, and Operators.

Built by [BIZMYZE](mailto:ausafahmed04@gmail.com) under a fixed-scope agreement.

The signed proposal in [`proposal.docx`](./proposal.docx) (Section 2) is the definitive feature list. The phased build sequence lives in `HK_ENV_WebApp_ClaudeCode_BuildPlan.md`.

---

## Quick start (5 commands)

You need **Node.js 20+** and a **PostgreSQL** database (any provider — local install, Docker, Neon, Supabase, RDS, CloudBase, etc.).

```bash
npm install                                        # 1. install dependencies
cp .env.example .env.local                         # 2. copy env template
# edit .env.local — set DATABASE_URL and AUTH_SECRET (see below)
npm run db:deploy                                  # 3. apply schema
npm run db:seed:demo                               # 4. load realistic demo data
npm run dev                                        # 5. open http://localhost:3000
```

### Required env vars

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Example: `postgresql://user:pw@host:5432/hkenv?schema=public` |
| `AUTH_SECRET` | 32+ random bytes for signing the pending-login cookie. Generate: `openssl rand -base64 32` |
| `AUTH_URL` | Public origin (e.g. `https://hkenv.example.com`) — used to build password-reset links |

### Optional env vars

| Var | Purpose |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Outbound email for password reset. **If `SMTP_HOST` is unset, reset links print to the server console** so dev/QA can exercise the flow without a real SMTP. |
| `SMTP_SECURE` | `"true"` to use TLS on connect (port 465). Default `"false"` (STARTTLS on 587). |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_NAME` / `SEED_OWNER_PASSWORD` | Override the default Owner seeded by `npm run db:seed`. |

---

## Demo accounts (after `npm run db:seed:demo`)

All demo accounts use password `DemoPass!2026`. The real seeded Owner is unchanged at `owner@hkenv.local` / `ChangeMe!2026`.

| Role | Email | Notes |
|---|---|---|
| Owner | helena.owner@demo.hkenv.local | Can approve/decline exceptions |
| Admin | sarah.admin@demo.hkenv.local | Created most dispatches |
| Admin | mike.admin@demo.hkenv.local | |
| Operator | olin.op@demo.hkenv.local | Drives DEMO-AY-1801 (Red, Tri-Axle) |
| Operator | priya.op@demo.hkenv.local | **Has a DRAFT ticket in progress** + an in-flight dispatch |
| Operator | chen.op@demo.hkenv.local | |
| Operator | maria.op@demo.hkenv.local | |
| Operator | sam.op@demo.hkenv.local | **Has a FLAGGED dispatch** (truck overheating) |

The first time you sign in as any account, you'll be prompted to scan a QR code in an authenticator app (Google / Microsoft Authenticator / 1Password / etc.). After that, every login asks for a 6-digit TOTP.

**Tour highlights:**

- **/dashboard** — Welcome card + module summary
- **/admin** (Admin/Owner) — Master dashboard with stat tiles, arrival alerts panel, active project cards with progress bars
- **/admin/dispatch** — Live dispatch board, auto-refreshes every 5s, status filters
- **/admin/gps** — Trip history + map replay + top-routes analytics
- **/admin/tickets** — Review queue (defaults to SUBMITTED); approve, flag, request Owner override
- **/admin/tickets/[id]** — "Download PDF" gives the clean print-ready version
- **/owner** — Exception queue (Admin can view, only Owner can decide)
- **/operator** (sign in as Priya) — In-flight dispatch with GPS tracker pill
- **/operator/tickets** — Tap any DRAFT to sign and submit on a phone

---

## Status — every phase delivered

| Phase | Module | Status |
|-------|--------|--------|
| 0 | Foundation (scaffold, shell, role-aware skeleton) | ✅ |
| 1 | Authentication (email/password, password reset, 2FA, login/logout location) | ✅ |
| 2 | User & role management (employee IDs, deactivate/delete, list/search) | ✅ |
| 3 | Truck & driver management (plates, types, status, assignment, photos) | ✅ |
| 4 | Projects & dashboards (budget, progress, assignments, vault) | ✅ |
| 5 | Dispatch system (schedule, accept/flag, live status board) | ✅ |
| 6 | GPS & location history (trip recording, map replay, route analytics) | ✅ |
| 7 | Digital load ticketing (fillable, sign + submit, approve/flag, print) | ✅ |
| 8 | End-of-haul submission & arrival alerts (Complete Load, photos, live timer) | ✅ |
| 9 | Owner exception approvals (auto-raise on flag/late/override, decision audit) | ✅ |
| 10 | Reports & exports (PDF / CSV for tickets, trips, projects, trucks, operators) | ✅ |
| 11 | QA, demo seed, polish, README | ✅ |

---

## Tech stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Prisma 7** ORM with **PostgreSQL** via `@prisma/adapter-pg` (swappable to MySQL / SQL Server / MongoDB / SQLite — change the `provider` in `prisma/schema.prisma` and adapter)
- **bcryptjs** password hashing, **otplib** TOTP 2FA, **qrcode** for setup QR images
- **nodemailer** for transactional email (console fallback when SMTP unset)
- **leaflet** + **react-leaflet** + OpenStreetMap tiles (no API key) for the GPS map
- **@react-pdf/renderer** for server-rendered PDF exports
- DB-backed sessions with HTTP-only cookies; 256-bit tokens stored as SHA-256 hashes

---

## Deployment — getting this on the web

The app is a standard Node.js / Next.js server. It runs on any platform with Node 20+ runtime. **Three vetted paths:**

### Option A — Vercel + Neon (recommended for fastest demo)

This gives you a public HTTPS URL in about 10 minutes, with a free Postgres database.

1. **Push the repo to GitHub** (if you haven't already): `git push -u origin master`.
2. **Create a Postgres at Neon**: <https://neon.tech> → New Project (free tier) → copy the connection string (the *Pooled* one, ends in `?sslmode=require`).
3. **Deploy on Vercel**: <https://vercel.com/new> → Import your GitHub repo → leave framework as "Next.js" → click Deploy. First build will fail because env vars aren't set yet — that's fine.
4. **In Vercel → Settings → Environment Variables**, add:
   - `DATABASE_URL` = the Neon connection string from step 2
   - `AUTH_SECRET` = output of `openssl rand -base64 32`
   - `AUTH_URL` = your Vercel deployment URL (e.g. `https://hkenv-webapp.vercel.app`)
5. **Apply schema + seed demo data** — from your local terminal with the same `DATABASE_URL` in `.env.local`:
   ```bash
   npm run db:deploy
   npm run db:seed:demo
   ```
6. **Redeploy** in Vercel (Deployments → ⋯ → Redeploy) to pick up the env vars.
7. **Open the URL** — sign in as `helena.owner@demo.hkenv.local` / `DemoPass!2026`.

**Limitations on Vercel:** the photo + document upload features (operator photos, project documents, ticket photos) write to `public/uploads/` which is **read-only on serverless**. For production, swap those three lib functions to write to object storage (S3 / R2 / Tencent COS) — see "What still needs attention" below.

### Option B — Railway (one-platform Postgres + Node)

1. Push to GitHub.
2. <https://railway.app> → New Project → Deploy from GitHub repo.
3. In the project, add a **PostgreSQL** plugin — Railway auto-injects `DATABASE_URL`.
4. Add `AUTH_SECRET` and `AUTH_URL` env vars (Settings → Variables).
5. From local, run `npm run db:deploy && npm run db:seed:demo` against Railway's external Postgres URL.
6. Open the Railway-generated URL.

Same file-storage caveat as Vercel.

### Option C — Self-hosted (any VPS, IIS, or HK's own server)

```bash
git clone <your-repo-url>
cd hk-web-app
npm install
cp .env.example .env.local
# edit .env.local with your DB connection + AUTH_SECRET + AUTH_URL
npm run db:deploy
npm run db:seed:demo            # optional: skip for production
npm run build
NODE_ENV=production npm start   # listens on http://0.0.0.0:3000
```

Put it behind nginx, Caddy, IIS, or any reverse proxy that handles HTTPS. File uploads work fine on a VPS (writes to the local filesystem).

---

## Project structure

```
.
├── prisma/
│   ├── schema.prisma                  # 17 models across 9 phases
│   ├── migrations/                    # 9 phased migrations
│   ├── seed.ts                        # bare-minimum: 1 Owner (production seed)
│   └── seed-demo.ts                   # realistic demo dataset (QA / demo seed)
├── prisma.config.ts                   # Prisma 7 config (loads .env then .env.local)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root HTML
│   │   ├── page.tsx                   # → /dashboard
│   │   ├── globals.css                # Tailwind + brand tokens + @media print rules
│   │   ├── login/                     # Multi-step: email+pw → TOTP setup or verify
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── (app)/                     # Authenticated app group (requireUser guard)
│   │   │   ├── layout.tsx             # Nav + RoleBadge + SignOutButton + footer
│   │   │   ├── _ticket/TicketView.tsx # Shared print-ready ticket render
│   │   │   ├── dashboard/
│   │   │   ├── operator/              # /operator + /operator/tickets/*
│   │   │   ├── admin/                 # /admin (master dashboard)
│   │   │   │   ├── dispatch/          # board, new, [id]
│   │   │   │   ├── gps/               # list + replay
│   │   │   │   ├── projects/          # list, new, [id] (with vault picker)
│   │   │   │   ├── tickets/           # review queue, [id]
│   │   │   │   ├── trucks/            # list, new, [id] (assignment)
│   │   │   │   ├── operators/         # driver list, [id] (photo)
│   │   │   │   └── users/             # roster, new
│   │   │   └── owner/                 # Exception queue + decision
│   │   └── api/
│   │       ├── auth/                  # login, logout, totp/setup, totp/verify, forgot/reset
│   │       ├── operators/[id]/photo/  # photo upload
│   │       ├── projects/[id]/documents/   # document vault upload
│   │       ├── tickets/[id]/photos/   # ticket photo upload
│   │       ├── trips/[id]/points/     # GPS sample ingestion
│   │       └── exports/               # CSV/PDF for tickets/trips/projects/trucks/operators
│   ├── components/                    # Nav, badges, GpsTracker, MapReplay, SignaturePad, etc.
│   ├── lib/                           # All business logic (auth, dispatches, tickets, …)
│   └── proxy.ts                       # Next 16 request proxy: cookie pre-check
├── public/uploads/                    # User-uploaded files (gitignored, not deployed)
├── .env.example                       # Documented env vars
└── proposal.docx                      # Signed scope agreement — read first
```

---

## NPM scripts

| Script | What it does |
|---|---|
| `npm install` | Installs deps + runs `prisma generate` via `postinstall` |
| `npm run dev` | Dev server on http://localhost:3000 (Turbopack) |
| `npm run build` | Production build (typecheck + bundle) |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` — for dev (creates + applies migrations) |
| `npm run db:deploy` | `prisma migrate deploy` — for prod (applies committed migrations) |
| `npm run db:studio` | Open Prisma Studio (browse the DB) |
| `npm run db:seed` | Bare-minimum seed: 1 Owner. Safe to re-run. |
| `npm run db:seed:demo` | Rich demo dataset (8 users, 6 trucks, 3 projects, 17 dispatches, 12 tickets, …). Wipes prior demo data and rebuilds. |

---

## For HK IT (database & hosting responsibilities)

Per **proposal Section 5**, HK Environmental Group's internal IT team owns all database provisioning, hosting, server management, and ongoing infrastructure. BIZMYZE delivers the application layer only.

**To point this app at HK's database:**

1. Provision a PostgreSQL 14+ instance and create an empty database.
2. Set `DATABASE_URL` in the runtime env (Vercel/Railway/CloudBase/VPS — wherever the app runs).
3. Apply the schema: `npm run db:deploy`.
4. Set `AUTH_SECRET` (32+ random bytes) and `AUTH_URL` (your public origin).
5. Set SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) — needed for password reset emails to actually send.

**Using a different database engine?** Prisma supports PostgreSQL, MySQL, Microsoft SQL Server, MongoDB, and SQLite. Switch `provider` in `prisma/schema.prisma`, install the matching `@prisma/adapter-*`, and update `src/lib/db.ts`. We will help wire the alternate adapter when you confirm the target.

**File storage in production:** photo + document uploads currently write to local disk under `public/uploads/`. On a serverless host (Vercel, Lambda) the filesystem is read-only and uploads will fail. On a VPS/IIS host they work as-is. Either way, **for production we recommend swapping to object storage** (S3, R2, Tencent COS) — see [What still needs attention](#what-still-needs-attention) below.

---

## What still needs attention

Honest list of things HK should know before / shortly after going live:

1. **File storage.** `public/uploads/` on local disk is fine for self-hosted but won't survive a serverless deploy. Production should swap [`saveAndDeletePhoto`](src/lib/operators.ts), [`uploadDocument`/`deleteDocument`](src/lib/projects.ts), [`addTicketPhoto`/`deleteTicketPhoto`](src/lib/tickets.ts) to write to S3-compatible object storage. Estimated work: half a day.
2. **CloudBase confirmation.** You mentioned "CloudBase or something" as the eventual host — please confirm so we can validate the stack works there (it's Node-based, so it should, but the file-storage point above applies).
3. **Bulk operations.** No mass-cancel, mass-approve, or mass-export. If HK regularly needs to act on many records at once, add a multi-select layer to the list pages. Estimated work: a day per page.
4. **Late-submission threshold** is a single constant (24h) in [`src/lib/exceptions.ts`](src/lib/exceptions.ts#L21). If HK wants per-project or per-client thresholds, that becomes a config table. Half-day.
5. **PDF photo limit.** Single-ticket PDFs include the first 9 photos. Rest are skipped (avoids multi-page bloat). Tunable in [`src/lib/exports/pdf.tsx`](src/lib/exports/pdf.tsx).
6. **Map replay doesn't auto-pan** on a live trip. The map fits to all known points on load; later points (after auto-refresh) appear but don't pan into view. Add a "Follow operator" toggle if needed.
7. **Owner permissions include Admin's.** An Owner can do everything an Admin can. If HK wants strict separation (Owner-only mode where Owner can't directly create tickets, only review exceptions), the [hasAccess hierarchy in `src/lib/roles.ts`](src/lib/roles.ts) is the single seam.
8. **Sessions don't auto-rotate.** A session cookie is good for 7 days. Idle timeout / forced re-auth on sensitive actions can be added if HK's security policy requires it.
9. **Local Postgres dev quirk.** The optional `npx prisma dev` local Postgres has a connection-drop issue with the PG adapter; doesn't affect any real Postgres. For local dev use Docker, the OS Postgres, or any cloud Postgres free tier.
10. **Operator photos limited to 1 per profile** (replaces on re-upload). If HK wants a history (e.g. WHMIS card, vest ID), promote to a `OperatorPhoto[]` model — half-day.

None of these block the demo or initial production rollout — they're follow-ups.

---

## License

Intellectual property transfers to HK Environmental Group upon receipt of full and final payment per **proposal Section 10**.

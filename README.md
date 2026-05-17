# HK ENV. WEB-APP

A browser-based operations platform for **HK Environmental Group** — haul/trucking dispatch, GPS trip tracking, digital load ticketing, project budgets, and role-based access for Owners, Admins, and Operators.

Built by [BIZMYZE](mailto:ausafahmed04@gmail.com) under a fixed-scope agreement.

## Scope source of truth

The signed proposal in [`proposal.docx`](./proposal.docx) (Section 2) is the definitive feature list. The phased build sequence lives in `HK_ENV_WebApp_ClaudeCode_BuildPlan.md`. Nothing outside that scope is in this codebase.

## Current status

| Phase | Module | Status |
|-------|--------|--------|
| 0 | Foundation (scaffold, shell, role-aware skeleton) | ✅ Done |
| 1 | Authentication (email/password, password reset, 2FA, login/logout location) | ✅ Done |
| 2 | User & role management (employee IDs, deactivate/delete, list/search) | ✅ Done |
| 3 | Truck & driver management (plates, types, status, assignment, photos) | ✅ Done |
| 4 | Projects & dashboards (budget, progress, assignments, vault) | ✅ Done |
| 5 | Dispatch system | ⏳ |
| 6 | GPS & location history | ⏳ |
| 7 | Digital load ticketing (eTicketing) | ⏳ |
| 8 | End-of-haul submission & arrival alerts | ⏳ |
| 9 | Owner exception approvals | ⏳ |
| 10 | Reports & exports (PDF / CSV) | ⏳ |
| 11 | QA, seed data, polish, demo prep | ⏳ |

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** for mobile-first responsive UI
- **Prisma 7** ORM with **PostgreSQL** (swappable via Prisma adapter)
- **bcryptjs** password hashing, **otplib** TOTP 2FA, **qrcode** for setup QR images
- **nodemailer** for transactional email (console fallback when SMTP isn't configured)
- DB-backed sessions with HTTP-only cookies; 256-bit tokens stored as SHA-256 hashes

## Prerequisites

- **Node.js 20+** (project tested on Node 24)
- **npm 10+**
- **PostgreSQL 14+** — required from Phase 1 onward. Local options:
  - your own Postgres install
  - Docker: `docker run -d --name hkenv-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16`
  - Prisma's built-in local Postgres: `npx prisma dev` (writes a `DATABASE_URL` automatically)

## Local setup

```bash
# 1. Install dependencies (also generates the Prisma client via postinstall)
npm install

# 2. Configure environment
cp .env.example .env.local
# edit .env.local — at minimum set DATABASE_URL and AUTH_SECRET
# AUTH_SECRET:  openssl rand -base64 32

# 3. Apply the schema
npm run db:migrate

# 4. Create the first user (Owner)
npm run db:seed
# logs the email / password it created — change them via SEED_OWNER_*
# vars in .env.local before running, if you like

# 5. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

### Signing in for the first time

1. Go to `/login`. Use the email + password printed by `npm run db:seed`.
2. After the password step, the app shows a QR code. Open Google Authenticator, Microsoft Authenticator, 1Password, etc. and scan it.
3. Enter the 6-digit code. The browser asks for location permission — accept to record GPS with the login event (proposal §2.1). Denial is allowed; the denial reason is recorded instead.
4. You land on `/dashboard`. The role badge in the top-right reflects the Owner role you seeded.

### Password reset

- Click "Forgot password?" on `/login` to email yourself a reset link.
- Without SMTP configured, the link is printed to the server console (`npm run dev` terminal) instead of sent — handy for local QA.
- Resetting a password revokes all existing sessions and forces fresh 2FA setup on next sign-in.

## Project structure

```
.
├── prisma/
│   ├── schema.prisma         # Role, User, Session, SessionEvent, PasswordReset
│   └── seed.ts               # `npm run db:seed` — creates first Owner
├── prisma.config.ts          # Prisma 7 config (DB URL for migrations)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Redirects to /dashboard (proxy bounces to /login if no session)
│   │   ├── globals.css
│   │   ├── login/            # Multi-step: email+password → TOTP setup or verify
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── (app)/            # Authenticated app group
│   │   │   ├── layout.tsx    # requireUser() guards the whole group
│   │   │   ├── dashboard/
│   │   │   ├── operator/
│   │   │   ├── admin/        # requireUser("ADMIN")
│   │   │   └── owner/        # requireUser("OWNER")
│   │   └── api/auth/
│   │       ├── login/        # POST email+password → pending-login cookie
│   │       ├── logout/       # POST geo → revoke session + log LOGOUT event
│   │       ├── totp/setup/   # POST → returns QR data URL + secret
│   │       ├── totp/verify/  # POST code+geo → open Session, log LOGIN event
│   │       ├── forgot-password/  # POST email → email reset link
│   │       └── reset-password/   # POST token+newPassword → change password
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── RoleBadge.tsx
│   │   ├── PlaceholderCard.tsx
│   │   └── SignOutButton.tsx
│   ├── lib/
│   │   ├── auth.ts           # startSession, endSession, getSessionUser, cookie helpers
│   │   ├── db.ts             # PrismaClient + PrismaPg adapter singleton
│   │   ├── email.ts          # nodemailer w/ console fallback
│   │   ├── geo.ts            # server-side: parse + bounds-check GeoCapture
│   │   ├── geo-client.ts     # browser: navigator.geolocation wrapper
│   │   ├── password.ts       # bcrypt hash/verify + strength check
│   │   ├── pending-login.ts  # HMAC-signed cookie carrying the multi-step state
│   │   ├── roles.ts          # Role type, hasAccess()
│   │   ├── session.ts        # requireUser() server-side guard for pages
│   │   ├── session-types.ts
│   │   ├── tokens.ts         # opaque tokens + sha256 + timingSafeEqual
│   │   └── totp.ts           # otplib + qrcode wrappers
│   ├── generated/prisma/     # Generated Prisma client (gitignored)
│   └── proxy.ts              # Next 16 request proxy: optimistic cookie check
├── .env.example              # Documented env vars; copy to .env.local
└── proposal.docx             # Signed scope agreement — read first
```

## For HK IT (database & hosting)

Per **proposal Section 5**, HK Environmental Group's internal IT team owns all database provisioning, hosting, server management, and ongoing infrastructure. BIZMYZE delivers the application layer only.

**Database.** Provision PostgreSQL 14+, create an empty database, and set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/hkenv?schema=public"
```

Apply the schema in production with:

```bash
npm run db:deploy
```

**Different engine?** Prisma supports PostgreSQL, MySQL, Microsoft SQL Server, MongoDB, and SQLite. Switch `provider` in `prisma/schema.prisma` and update the `DATABASE_URL` format accordingly. We'll help wire the alternate adapter when you confirm the target.

**Auth secret.** Set `AUTH_SECRET` to 32+ random bytes (e.g. `openssl rand -base64 32`). Rotating it invalidates all in-flight pending-login cookies and forces users to restart the login flow (existing sessions are unaffected — they live in the database).

**Email.** Provide an SMTP relay (any provider) and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Without these, the password-reset link is logged to stdout instead of sent — fine for staging, not for production.

**Hosting platform.** Standard Node.js / Next.js app. Runs on any platform with Node 20+ runtime: AWS, Azure, Google Cloud, Tencent CloudBase, Vercel, Railway, Render, self-managed VMs, or behind a reverse proxy in front of IIS. `npm run build` then `npm start`.

## License

Intellectual property transfers to HK Environmental Group upon receipt of final payment per **proposal Section 10**.

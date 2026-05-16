# HK ENV. WEB-APP

A browser-based operations platform for **HK Environmental Group** — haul/trucking dispatch, GPS trip tracking, digital load ticketing, project budgets, and role-based access for Owners, Admins, and Operators.

Built by [BIZMYZE](mailto:ausafahmed04@gmail.com) under a fixed-scope agreement.

## Scope source of truth

The signed proposal in [`proposal.docx`](./proposal.docx) (Section 2) is the definitive feature list. The phased build sequence lives in `HK_ENV_WebApp_ClaudeCode_BuildPlan.md`. Nothing outside that scope is in this codebase.

## Current status

| Phase | Module | Status |
|-------|--------|--------|
| 0 | Foundation (scaffold, shell, role-aware skeleton) | ✅ Done |
| 1 | Authentication (email/password, password reset, 2FA, login/logout location) | ⏳ Next |
| 2 | User & role management | ⏳ |
| 3 | Truck & driver management | ⏳ |
| 4 | Projects & dashboards | ⏳ |
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
- **Prisma 7** ORM with **PostgreSQL** (swappable to MySQL / SQL Server / MongoDB / SQLite via Prisma)
- **ESLint** (Next defaults)

Auth (NextAuth.js / Auth.js + TOTP 2FA) is wired in Phase 1.

## Prerequisites

- **Node.js 20+** (project tested on Node 24)
- **npm 10+**
- **PostgreSQL** instance — only needed once Phase 1+ begins to read/write data. Phase 0 runs without a database.

## Local setup

```bash
# 1. Install dependencies (also generates the Prisma client via postinstall)
npm install

# 2. Configure environment
cp .env.example .env.local
# then edit .env.local — at minimum set DATABASE_URL

# 3. (Once you have a database) apply schema
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

### Testing the role-aware shell (Phase 0 only)

Real authentication is Phase 1. Until then, the current user is stubbed via `src/lib/session.ts`. Flip the stub role in `.env.local`:

```env
DEV_STUB_ROLE="OWNER"     # sees Dashboard, Operator, Admin, Owner links
DEV_STUB_ROLE="ADMIN"     # sees Dashboard, Operator, Admin
DEV_STUB_ROLE="OPERATOR"  # sees Dashboard, Operator
```

Restart the dev server after changing.

## Project structure

```
.
├── prisma/
│   └── schema.prisma         # Role enum + User (grows per phase)
├── prisma.config.ts          # Prisma 7 config (DB URL for migrations)
├── public/                   # Static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout (html, body, fonts)
│   │   ├── page.tsx          # Landing — redirects to /dashboard
│   │   ├── globals.css       # Tailwind import + brand tokens
│   │   ├── login/            # Phase 0 placeholder; Phase 1 real form
│   │   └── (app)/            # Authenticated app group
│   │       ├── layout.tsx    # Header, nav, role badge, footer
│   │       ├── dashboard/
│   │       ├── operator/
│   │       ├── admin/        # Page guards to ADMIN+
│   │       └── owner/        # Page guards to OWNER only
│   ├── components/
│   │   ├── Nav.tsx           # Responsive nav (hamburger on mobile)
│   │   ├── RoleBadge.tsx
│   │   └── PlaceholderCard.tsx
│   ├── lib/
│   │   ├── db.ts             # Prisma client singleton (adapter wired Phase 1)
│   │   ├── roles.ts          # Role type, hasAccess()
│   │   └── session.ts        # getCurrentUser() — Phase 0 stub
│   ├── generated/prisma/     # Generated Prisma client (gitignored)
│   └── proxy.ts              # Next.js 16 request proxy (was middleware)
├── .env.example              # Documented env vars; copy to .env.local
└── proposal.docx             # Signed scope agreement — read first
```

## For HK IT (database & hosting)

Per **proposal Section 5**, HK Environmental Group's internal IT team owns all database provisioning, hosting, server management, and ongoing infrastructure. BIZMYZE delivers the application layer only.

To point this app at your managed database:

1. Provision a PostgreSQL instance (any version 14+).
2. Create an empty database and a user with full privileges on it.
3. In your hosting environment, set the env var:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
   ```

4. Apply the schema:

   ```bash
   npx prisma migrate deploy
   ```

5. Set `AUTH_SECRET` (32+ random bytes) and `AUTH_URL` (your public origin).

**Using a different database engine?** Prisma supports PostgreSQL, MySQL, Microsoft SQL Server, MongoDB, and SQLite. To switch, change `provider` in `prisma/schema.prisma` and update the `DATABASE_URL` format accordingly. We will help with that when you confirm the target.

**Hosting platform.** This app is a standard Node.js / Next.js application. It runs on any platform with Node 20+ runtime: AWS, Azure, Google Cloud, Tencent CloudBase, Vercel, Railway, Render, self-managed VMs, or behind a reverse proxy in front of IIS. The `npm run build` output is served by `npm start`.

## License

Intellectual property transfers to HK Environmental Group upon receipt of final payment per **proposal Section 10**.

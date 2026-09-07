# Kashmir View Lodges — Hotel & Management System

A production-grade hotel + restaurant management platform, built on Next.js and PostgreSQL, deployable to Vercel.

> **Where this came from:** this app replaces `almadina/` (kept in the repository root, untouched, as a historical
> reference) — a BS-AI final-year-project prototype built on a single-file Express server, `sql.js` (SQLite that
> rewrote its entire database file to disk on every write), and a single static HTML file with in-browser React. None
> of that runs on Vercel. This is a from-scratch rebuild on a real architecture, carrying forward the same feature
> set and design language, with the gaps and security issues found during that audit fixed. See **Milestones** below
> for exactly what's in this build versus what's planned next.

## Architecture

- **Framework:** Next.js 16 (App Router, Route Handlers), TypeScript, React 19
- **Styling:** Tailwind CSS v4, a custom dark/light design system (CSS custom properties, `app/globals.css`)
- **Database:** PostgreSQL via Prisma ORM 7 (driver-adapter mode — see `lib/db.ts`)
- **File storage:** Vercel Blob (OCR bill images)
- **Auth:** Custom JWT (via `jose`) in an `HttpOnly` cookie — not a third-party auth library, because the app's
  username+PIN login and granular permission model don't map cleanly onto one; see `lib/auth/session.ts`
- **AI:** Anthropic Claude (vision) for the OCR bill scanner, called server-side only
- **Offline:** Service worker (app-shell caching) + an IndexedDB write-queue (`lib/offline/`) that syncs through
  `/api/sync/push` once the connection returns
- **Charts:** Recharts

### Why Next.js Route Handlers instead of Server Actions

Every mutation that has an offline-queue equivalent (creating a booking, placing an order, ...) needs a stable HTTP
endpoint that both the browser and the offline-sync dispatcher can call identically. Route Handlers give one
`{success, data}` / `{success: false, error}` envelope everywhere (`lib/api/respond.ts`) rather than two different
calling conventions depending on which page happens to use a Server Action.

### Data model

The full schema is in `prisma/schema.prisma`. Two design choices worth knowing about:

- **Room availability is a query, not a status field.** `Room.status` (`AVAILABLE`/`OCCUPIED`/`CLEANING`/...) only
  tracks whether housekeeping/maintenance has a room ready *right now*. Whether a room is free for a given
  `[checkIn, checkOut)` date range is a separate query against `Booking` rows (`lib/services/availability.ts`),
  enforced twice: once in application code (shared by the online booking route and the offline-sync dispatcher), and
  again by a Postgres `EXCLUDE` constraint on the `Booking` table (added by hand to the first migration — Prisma's
  schema language has no syntax for it) so a double-booking is structurally impossible even if application logic has
  a bug.
- **Role-based access control is data, not code.** `Role` / `Permission` / `RolePermission` tables hold dot-notation
  permission keys (`hotel.create_booking`, `restaurant.cancel_order`, ...), checked server-side on every sensitive
  route via `requirePermission()` in `lib/auth/permissions.ts`. Every route calls this explicitly at the top of its
  handler — deliberately not hidden in generic middleware — so the required permission for any action stays
  grep-able at the call site.

## Milestone 1 (this build) vs. what's next

This is intentionally a smaller set of modules that are genuinely complete and working, not a wide skeleton with
unfinished pieces. **Built and working:**

- Auth (username + PIN, JWT session, granular RBAC), 8 roles
- Hotel: room grid, real date-range availability, reservations (create/check-in/check-out/cancel/discount), guest CRM
- Restaurant: POS (dine-in/takeaway/room-service), live order board, billing
- Housekeeping board, room status workflow
- OCR bill scanner (Claude vision), server-side-only API key, graceful "not configured" state
- Staff management, audit log, security alerts
- Dashboard (KPIs + charts) and a Reports page
- Settings (business name/currency/tax/timezone)
- PWA: installable, offline app-shell caching, IndexedDB write-queue with sync status
- Automated tests (Vitest): validation rules, money rounding, double-booking prevention

**Deliberately not in this build** — tracked as follow-on work, not silently dropped:

- **Milestone 2:** Inventory + recipe-based stock deduction, Purchases/Suppliers, Expenses, Cash register/shift,
  Kitchen Display System, Maintenance ticketing, split bills/refunds, printable invoice PDFs
- **Milestone 3:** AI sales/inventory forecasting, anomaly detection, notification center, global search (`Ctrl+K`),
  CSV/PDF report export, roles-and-permissions admin UI, broader automated test coverage

The Prisma schema already includes dormant tables for Milestone 2 (`InventoryItem`, `Supplier`, `PurchaseOrder`,
`Expense`, `RecipeItem`) so that work won't need a disruptive migration later.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` (see [DEPLOYMENT.md](./DEPLOYMENT.md) for how to get one) and generate a `JWT_SECRET`:

```bash
openssl rand -base64 32
```

`BLOB_READ_WRITE_TOKEN` and `ANTHROPIC_API_KEY` are optional for local development — the app runs without them; the
OCR page just shows a "not configured" state without the latter.

### 3. Run database migrations and seed demo data

```bash
npm run db:migrate
npm run db:seed
```

The seed script is idempotent (safe to re-run) and creates realistic **demo data**, clearly not real business
records: 9 staff accounts across all roles (2 waiters, on different shifts, to show role-sharing), 24 rooms across 4
room types, sample guests/bookings in different states, 6 restaurant tables, 33 menu items, and sample audit-log/alert
entries. Demo login credentials (username / PIN):

| Role | Username | PIN |
|---|---|---|
| Owner | `owner` | `9999` |
| Manager | `manager` | `4444` |
| Receptionist | `kamran` | `1234` |
| Waiter | `tariq` | `3333` |
| Waiter | `zainab` | `5555` |
| Housekeeper | `ayesha` | `2222` |
| Kitchen Staff | `bilal` | `6666` |
| Cashier | `sana` | `7777` |
| Inventory Manager | `imran` | `8888` |

**Change these before using the app with real guest or payment data.**

### 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Development

```bash
npm run lint        # ESLint
npx tsc --noEmit    # Type check
npm test            # Vitest — unit tests run without a database;
                     # the double-booking integration test needs a real DATABASE_URL
npm run build       # Production build
npm run db:studio   # Prisma Studio — browse/edit data directly
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for exact Vercel deployment steps, required environment variables, and
storage/AI configuration.

## Troubleshooting

- **`JWT_SECRET is not set` error on login:** add `JWT_SECRET` to `.env` (see step 2 above).
- **Prisma errors mentioning `adapter` or `datasource.url`:** this project uses Prisma 7's driver-adapter mode —
  connection info lives in `prisma.config.ts` (which reads `DATABASE_URL`) and `lib/db.ts` (which constructs the
  `PrismaPg` adapter), not in `schema.prisma`. Make sure `DATABASE_URL` is set in `.env`.
- **OCR page says "not configured":** expected without `ANTHROPIC_API_KEY` — the rest of the app works normally.
- **Special characters in your local folder path:** if you cloned this into a path containing `&` or unbalanced
  parentheses on Windows, some tools that shell out internally (this bit us once during development, in
  `create-next-app`'s own postinstall step) can misbehave. Prefer a plain path, or map a clean drive letter to it
  (`subst K: "<path>"`) and work from there.

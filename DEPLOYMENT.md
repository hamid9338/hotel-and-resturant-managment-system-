# Deploying to Vercel

## 1. Create the database

**Option A — Vercel Postgres (recommended, matches this project's docs and env var names):**

1. In the [Vercel dashboard](https://vercel.com/dashboard), open your project (or create one after step 3) → **Storage** tab → **Create Database** → **Postgres**.
2. Vercel provisions a Neon-backed Postgres instance and offers to connect it to your project, which automatically
   adds `DATABASE_URL` (and a few related variables) to your project's environment variables. Use the **pooled**
   connection string — its hostname contains `-pooler` — since Vercel's serverless functions each get their own
   short-lived connection, and Postgres has a hard limit on total concurrent connections that a pooler avoids
   exhausting.

**Option B — Supabase, Neon (direct), or your own Postgres:** any standard Postgres connection string works. If your
provider doesn't include built-in pooling (Supabase and standalone Neon both offer a pooled connection option — use
it), be aware of the connection-limit issue above under serverless load.

## 2. Create the Blob store (for OCR bill image uploads)

In the same **Storage** tab → **Create Database** → **Blob**. Connecting it to your project adds
`BLOB_READ_WRITE_TOKEN` automatically.

## 3. Push this repository to GitHub (or GitLab/Bitbucket)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

## 4. Import the project into Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repository.
2. Framework preset: **Next.js** (auto-detected). No `vercel.json` is needed — this project uses no non-default
   settings (cron jobs, custom function config, redirects) that would require one.
3. If you completed steps 1–2 by connecting Storage to this Vercel project already, `DATABASE_URL` and
   `BLOB_READ_WRITE_TOKEN` are already set. Otherwise add them now under **Settings → Environment Variables**.

## 5. Set the remaining environment variables

In **Settings → Environment Variables**, add for the Production (and Preview, if you use it) environment:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | From step 1. Use the pooled connection string. |
| `JWT_SECRET` | Yes | Generate with `openssl rand -base64 32`. **Do not** reuse the value from `.env.example`, this file, or your local `.env` — generate a fresh one for production. |
| `BLOB_READ_WRITE_TOKEN` | Yes | From step 2. |
| `ANTHROPIC_API_KEY` | No | From https://console.anthropic.com. Without it, the app works normally and the Bill Scanner page shows a "not configured" state instead of failing. |

## 6. Run migrations against the production database

Vercel's build step does **not** run database migrations for you. Before (or right after) your first deploy, run
from your local machine with the production `DATABASE_URL` set:

```bash
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

Then, if this is a fresh database and you want the demo data (recommended for evaluating the app; **skip this in a
database that will hold real guest/business data**):

```bash
DATABASE_URL="<production-url>" npx prisma db seed
```

This has to be re-run any time you add a new migration (e.g. after pulling a future update to this project).

## 7. Deploy

Click **Deploy** in the Vercel dashboard, or push to your connected branch. The build runs `prisma generate` (via
the `build` script in `package.json`) before `next build`, so the generated Prisma client always matches the current
schema.

## 8. Verify

- Visit the deployed URL → you should land on `/login`.
- Log in with a seeded account (see README.md for the demo credentials) if you ran the seed script.
- Check `/api/health` — it should return `{"status":"ok","database":"connected",...}`. If it returns `"degraded"`,
  double-check `DATABASE_URL`.
- Try creating a reservation, placing a restaurant order, and (if you set `ANTHROPIC_API_KEY`) scanning a bill.

## Notes on this architecture and Vercel

- **No persistent local filesystem dependency.** All uploads go to Vercel Blob; the database is Postgres, not a
  file. Nothing in this app writes to the local filesystem at runtime.
- **No long-running processes.** Every route is a stateless serverless function. The one exception is the offline
  sync design, which is deliberately client-side (IndexedDB) rather than a server-side queue that would need a
  persistent worker.
- **CORS:** not configured, and shouldn't need to be — the frontend and API are the same Next.js app on the same
  origin. If you later split them, you'll need to add CORS headers to the API routes.
- **OCR upload size:** Vercel's server-upload path caps request bodies at ~4.5MB. The bill-scanner upload compresses
  images client-side before sending (`components/ocr/bill-scanner.tsx`) to stay well under that; if you need to
  support much larger source images, migrate to Vercel Blob's client-upload (browser → Blob directly) flow instead.
- **A new deploy does not carry forward `use cache` entries or any other build-scoped cache** (this project doesn't
  use Cache Components, so this mostly doesn't apply, but worth knowing if you adopt it later).

## Rolling back a bad deploy

Use Vercel's **Deployments** tab → find the last good deployment → **Promote to Production**. This does not roll
back the database — if a migration in the bad deploy needs reverting too, that's a manual `prisma migrate` operation
you run yourself; Vercel has no automatic database rollback.

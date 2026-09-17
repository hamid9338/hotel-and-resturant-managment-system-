# Local (on-site) deployment

This is a **second, independent deployment** of the same app, running on a machine at the restaurant itself, so staff can keep working when the internet is down. It talks to its own local PostgreSQL database over the restaurant's LAN/WiFi — no internet required for day-to-day operation. See [DEPLOYMENT.md](DEPLOYMENT.md) for the cloud/Vercel deployment, which is unaffected by any of this and should keep running as-is.

Two phases:
- **Phase 1 — local resilience.** The local server runs the full app on its own. Solves "the app doesn't load at all when internet is down" and "multiple devices can't see each other's changes while offline." Do this first — it's the urgent part.
- **Phase 2 — cloud sync.** A background worker on the local server pushes newly-created bookings/orders/etc. up to the cloud database whenever internet becomes available, so the cloud stays a fresh backup/mirror. Lower urgency — nothing depends on it to keep working day-to-day.

## Phase 1 — local resilience

### 1. Hardware

You need one always-on machine at the restaurant, reachable over the local WiFi/LAN. Two options:

- **A low-cost mini-PC** (Intel N100 class, roughly $120–200) — reliable x86 support (Prisma's database engine needs this), low power draw, fine to leave running 24/7. This is the recommended option if nothing below applies.
- **An existing always-on Windows or Linux PC** on-site (not a phone or tablet) — works at zero extra cost if you already have one that stays on.

Either way: Windows is assumed below (Node.js, NSSM). The same steps work on Linux with systemd in place of NSSM/Task Scheduler.

### 2. Install prerequisites on that machine

- **Node.js** — the same major version used for development (check with `node -v` on your dev machine).
- **Git** — to clone the repo.
- **Docker Desktop** (recommended path for local Postgres) — requires WSL2 on Windows. If Docker isn't viable on the hardware you're using, see the native-Postgres fallback below instead.

### 3. Local Postgres

**Primary path — Docker:**
```powershell
docker compose up -d
```
(run from the repo root — uses the `docker-compose.yml` already in this repo, Postgres 18 to match production, data persisted in a named Docker volume so it survives restarts).

**Fallback path — native install** (if Docker isn't workable on this hardware): install PostgreSQL 18 from [postgresql.org](https://www.postgresql.org/download/windows/), create a role/database matching what `docker-compose.yml` would have created (`kvl` / a password you choose / database `kvl_local`), and use that in `DATABASE_URL` below instead. Everything past this point is identical either way — the app only cares about the connection string.

### 4. Bootstrap the database — from a `pg_dump` of the live cloud database, not a fresh seed

This is the single easiest step to get wrong silently, so read this before running anything:

Every ID in this schema (`Room`, `MenuItem`, `User`, etc.) is a randomly-generated UUID. Running `npm run db:seed` against a brand-new empty database creates **different** random IDs for "Room 101," "Chicken Karahi," and so on than the ones already live in your cloud database. Bookings and orders reference rooms and menu items *by ID* — so if you seed fresh instead of restoring from the cloud, everything will look fine locally right up until Phase 2 tries to forward a booking to the cloud, at which point it fails outright (the cloud database has no row with that room ID).

Instead:

1. Dump the cloud database (get `DATABASE_URL` from Vercel's project settings):
   ```powershell
   pg_dump "<cloud DATABASE_URL>" -Fc -f kvl_cloud_backup.dump
   ```
2. Restore it into the fresh local Postgres:
   ```powershell
   pg_restore -d "postgresql://kvl:<password>@localhost:5432/kvl_local" --no-owner --no-privileges kvl_cloud_backup.dump
   ```
3. Catch up on any migration not yet reflected in that dump, and run the seed script as a safety net (it's idempotent — safe to run against a database that already has data; it only fills in anything genuinely missing, like the `sync_service` role once Phase 2 is set up):
   ```powershell
   npx prisma migrate deploy
   npm run db:seed
   ```

`pg_dump`/`pg_restore` ship with a PostgreSQL install (including inside Docker: `docker compose exec postgres pg_dump ...` also works if you don't have them installed directly on the host) — see the [PostgreSQL docs](https://www.postgresql.org/docs/current/app-pgdump.html) if you need to install just the client tools.

### 5. Configure the app

```powershell
git clone <this repo> C:\kvl-local
cd C:\kvl-local
copy .env.local-server.example .env
```
Fill in `.env`: `DATABASE_URL` (from step 3/4), `JWT_SECRET` (**copy the exact value from your Vercel production env vars** — needed so tokens verify correctly once Phase 2 is set up), `LOCAL_LAN_DEPLOYMENT=true`. Leave `CLOUD_SYNC_TARGET_URL` and the optional integrations (`BLOB_READ_WRITE_TOKEN`, `ANTHROPIC_API_KEY`, `WHATSAPP_*`) unset for now — see `.env.local-server.example` for what each does.

### 6. Build and run

```powershell
npm install
npm run build
npm run start
```
Confirm it works by visiting `http://localhost:3000` on the machine itself before moving on.

### 7. Run it as a persistent service (NSSM)

Without this, the app stops the moment someone closes the terminal window or the machine reboots.

1. Download [NSSM](https://nssm.cc/download), extract it somewhere permanent (e.g. `C:\nssm`).
2. Register the service:
   ```powershell
   C:\nssm\nssm.exe install KVL-LocalServer "C:\Program Files\nodejs\node.exe" "C:\kvl-local\node_modules\next\dist\bin\next start"
   C:\nssm\nssm.exe set KVL-LocalServer AppDirectory C:\kvl-local
   C:\nssm\nssm.exe set KVL-LocalServer AppExit Default Restart
   C:\nssm\nssm.exe start KVL-LocalServer
   ```
   NSSM restarts the process automatically if it ever crashes, and starts it on boot. (Task Scheduler — "Run at startup," SYSTEM account, "Run whether user is logged on or not," with a failure-restart trigger configured — is a documented fallback if you'd rather not install a third-party tool, but its crash-recovery is weaker; NSSM is the better default.)

### 8. Give it a stable address

On your router, set a **DHCP reservation** binding this machine's network adapter (its MAC address) to a fixed local IP — e.g. `192.168.1.50`. Without this, the machine could get a different IP after a reboot and every device's bookmark would silently stop working. Staff then reach the app at `http://192.168.1.50:3000` — bookmark this on every device.

### Verify Phase 1 before relying on it

1. **Unplug the router's WAN/internet cable** (leave the LAN/WiFi itself running).
2. From two separate devices, open `http://<the local IP>:3000`, log in as two different staff accounts, and reload the page — confirm you're still logged in after the reload. (This specifically checks the cookie fix in step 5: if it's broken, login *appears* to succeed once and then looks logged-out on the very next request — a plain `localhost` test on the server machine itself won't catch this, since `localhost` gets a browser exemption that a real LAN IP doesn't; you must test from a **different device** using the real LAN IP.)
3. From each device, run through one real flow per module: create and check in a reservation, place a POS order, adjust inventory stock, log an expense.
4. Visit `http://<the local IP>:3000/api/health` — confirm it reports the database as connected.
5. Open the Bill Scanner and Announcements pages — confirm they show their normal "not configured" messages rather than an error (expected, since those need internet regardless of local/cloud).
6. With both devices still connected and the WAN still unplugged, change a room's status from device A and confirm device B's room grid picks it up within about 15 seconds without a manual refresh — this is the proof that multiple devices are correctly sharing one live database rather than working in isolation.

Reconnect the WAN once you're done.

---

## Phase 2 — cloud sync

Once Phase 1 is running and verified, this adds a background worker that forwards newly-created bookings, orders, room-status changes, purchase orders, expenses, and stock adjustments up to the cloud database whenever the internet is available — so the cloud stays a fresh backup/mirror. Nothing in Phase 1 depends on this; it's safe to leave for later.

**What does *not* get mirrored to the cloud automatically**: menu edits, settings changes, guest profile edits, staff/role changes, and WhatsApp announcements. Only the 10 operation kinds above are forwarded. Make those kinds of changes directly wherever is convenient and expect to reconcile them manually if they diverge.

**Known limitation, by design — not a bug**: of the 10 kinds, `rooms.updateStatus` has no conflict check. If the same room is set to two different statuses both locally (during an outage) and directly on the cloud in the same window, it's silent last-write-wins — no flag, no alert. Every other kind (bookings, order status/items changes) does flag a genuine conflict for review. See the verification section below for a deliberate walkthrough of this so it's not a surprise later.

### 1. Deploy the schema migration to the cloud first, then local

```powershell
# Against the cloud DATABASE_URL (e.g. Vercel's production env)
npx prisma migrate deploy
npm run db:seed   # backfills the new "sync_service" role — idempotent, safe

# Then against the local DATABASE_URL
npx prisma migrate deploy
npm run db:seed
```

### 2. Create the sync-service account on both databases

Run once against each `DATABASE_URL` (cloud, then local) — this is a fixed-ID account the worker authenticates as; it's separate from the dump/restore in Phase 1 because by now your local database has real, local-only data the cloud doesn't have:

```powershell
npm run sync:create-service-account
```

### 3. Fill in the rest of the local `.env`

Set `CLOUD_SYNC_TARGET_URL` to your cloud deployment's URL (e.g. `https://your-app.vercel.app`). `JWT_SECRET` must already match production from Phase 1 setup — the worker mints its own session tokens and they need to verify on the cloud side.

### 4. Register the worker as its own service

Separate from the web server, so either can be stopped/restarted/monitored independently:
```powershell
C:\nssm\nssm.exe install KVL-SyncWorker "C:\Program Files\nodejs\node.exe" "C:\kvl-local\node_modules\.bin\tsx.cmd -r dotenv/config C:\kvl-local\scripts\cloud-sync-worker.ts"
C:\nssm\nssm.exe set KVL-SyncWorker AppDirectory C:\kvl-local
C:\nssm\nssm.exe set KVL-SyncWorker AppExit Default Restart
C:\nssm\nssm.exe start KVL-SyncWorker
```

### 5. Watch it work

Owner/manager accounts can watch sync activity at `/sync` — it now shows a second badge (`cloud: ...`) once an operation has been forwarded, alongside the existing local `status` badge. A `cloud: CONFLICT` or `cloud: FAILED` badge with a reason underneath means a human needs to look at it and reconcile manually; it will not resolve itself and the worker won't keep retrying it.

### Verify Phase 2

With the router's WAN still unplugged, perform one of each: create+check in a reservation, place a POS order, adjust stock, log an expense. Confirm rows appear at `/sync` with no `cloud:` badge yet (still pending). Reconnect the WAN and, within the worker's ~45-second poll interval, confirm the `cloud:` badges appear as `APPLIED` and the same records (same IDs) now exist in the cloud database.

Then see the known conflict behavior for yourself before relying on it in production: with WAN down, check in a booking locally. Separately — from a different internet connection entirely, not the restaurant's own WiFi (e.g. a phone on cellular data) — log into the live cloud URL directly and check in that *same* booking there too. Reconnect the local server's WAN and confirm the forwarded check-in comes back as `cloud: CONFLICT` with a reason shown at `/sync`, rather than silently vanishing or retrying forever. Now repeat the same dual-edit on a room's status specifically (set it to one status locally, a different status directly on the cloud) — this one will *not* show a conflict; whichever write reaches the cloud database last simply wins. Seeing this once means nobody discovers it for the first time during a real shift.

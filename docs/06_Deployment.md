# Deployment

Backend and PostgreSQL on Railway. Frontend on Vercel. Photos on Cloudflare R2.

Written 20 August 2026, from an audit that built and booted the production
image against a real database. Everything below has been run except the parts
marked **unverified**, which need accounts that do not exist yet.

---

## Why the database sits with the backend

One page load runs many queries, so backend-to-database latency compounds in a
way user-to-backend does not. Keeping them in the same Railway region costs
nothing and removes a network hop from every query.

Supabase was considered. Its one real advantage is a **Mumbai** region, which
would genuinely be faster for Hyderabad users — but Railway has no India region
(US, EU, Singapore), so the pairing would put the backend in Singapore and the
database in Mumbai, which is worse than either alone. We would also use only its
Postgres; auth and storage are already solved here.

Singapore is roughly 80–100ms to Hyderabad. Acceptable for launch. Mumbai is
what the AWS move is for.

---

## Before the first deploy

The API **refuses to boot** in production without these. That is deliberate —
each one silently loses money or data if it is missing.

| Blocker | Why the app refuses | Who unblocks it |
| --- | --- | --- |
| Razorpay keys | `PAYMENT_GATEWAY=dev` would confirm bookings with no payment taken | Neeraj — needs the company entity first |
| R2 credentials | `STORAGE_DRIVER=local` writes to a container filesystem that is wiped on every redeploy, so photos vanish | Neeraj — Cloudflare account |
| `CORS_ORIGINS` | An empty list in production is almost certainly a mistake | Set to the Vercel URL |

Not enforced by the app, but the deploy is useless without it:

- **Seed data.** Localities and amenities. With no localities, nobody can create
  a property — the area dropdown is empty.
- **Legal page details.** `apps/web/src/lib/legal.ts` still has `TODO`
  placeholders for the entity name, address and grievance officer. Razorpay
  checks those pages before activating an account.

---

## Deploying for testing, before Razorpay

This is the path to use while KYC is in progress.

The API refuses to start in production without Razorpay and R2. But there is a
sharper reason a test deployment cannot run as production: **nothing sends the
login code yet.** In production the code is not returned in the sign-in
response and no WhatsApp or SMS exists, so nobody could sign in at all —
including you.

So a test deployment runs with `NODE_ENV=development`, which returns the code
in the response and lets the development payment gateway confirm bookings
without money. That is exactly as dangerous as it sounds on a public URL, so
both halves get a shared password:

```
# Railway (API)
NODE_ENV=development
DEPLOY_GATE_TOKEN=<openssl rand -base64 32>
TRUST_PROXY=true
PAYMENT_GATEWAY=dev
DEV_WEBHOOK_SECRET=<any long random string>
STORAGE_DRIVER=local        # photos vanish on redeploy; acceptable for a test
CORS_ORIGINS=https://<your-app>.vercel.app
# plus DATABASE_URL and the three secrets from the production list

# Vercel (web)
API_BASE_URL=https://<api>.up.railway.app/api/v1
COOKIE_SECURE=1
DEPLOY_GATE_TOKEN=<the same token as the API>
SITE_PASSWORD=<a password you share with testers>
```

`SITE_PASSWORD` puts a browser prompt on the whole site — username
`pgplatform`. `DEPLOY_GATE_TOKEN` shuts the API to anything that does not
present it, so finding the Railway URL directly gets a 404 rather than the
ability to sign in as anybody. Both are unset in real production, where the
gate is off and the login code is never returned.

While `SITE_PASSWORD` is set, `robots.ts` disallows everything and every
response carries `X-Robots-Tag: noindex`. A crawled copy of a site that hands
out login codes would be difficult to undo.

**What still works:** the whole product. Browse, book, pay through the
development gateway, check in by QR, rent tracking. **What does not:** any real
money, any message, and photos survive only until the next redeploy.

---

## Environment

### Railway — API

```
NODE_ENV=production
PORT=                     # Railway sets this; do not hardcode
DATABASE_URL=             # from the Railway Postgres service
CORS_ORIGINS=https://<your-app>.vercel.app

JWT_ACCESS_SECRET=        # openssl rand -base64 48
JWT_REFRESH_SECRET=       # different from the access secret
FIELD_ENCRYPTION_KEY=     # openssl rand -base64 32

PAYMENT_GATEWAY=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

STORAGE_DRIVER=s3
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto

CHECKIN_GRACE_DAYS=7
PLATFORM_COMMISSION_BPS=400
PLATFORM_CONVENIENCE_FEE_PAISE=2500
```

Generate the three secrets fresh. Never reuse a development value — the ones in
`.env.example` are placeholders and are public.

### Vercel — web

```
API_BASE_URL=https://<api>.up.railway.app/api/v1
COOKIE_SECURE=1
```

`COOKIE_SECURE=1` matters: without it the session cookie is sent without the
Secure flag over HTTPS, which is both wrong and rejected by some browsers.

**There is no `NEXT_PUBLIC_*` variable, and that is deliberate.** Every API call
is made server-side, so the browser never talks to Railway directly. The API URL
is not public, there is no cross-origin request from the browser, and the
session cookie never leaves the Vercel domain.

---

## Deploy

### 1. Database

Create the Postgres service in Railway first — the API will not start without it.
Note the region; put the API in the same one.

### 2. API

Railway builds from `infrastructure/docker/backend.Dockerfile`, with the
repository root as the build context. Set that in the service settings, not a
Dockerfile path relative to a subdirectory.

Health check path: `/api/v1/health`.

### 3. Migrations — an explicit step, never at boot

```
pnpm --filter @pgplatform/backend prisma:deploy
```

Run it as a one-off Railway command against the deployed service, before the new
image takes traffic. Migrations at application boot mean two instances racing to
alter the same table.

The schema and migrations are baked into the image, so this runs the exact
migrations that were built, not whatever is on a laptop.

### 4. Seed — once

```
pnpm --filter @pgplatform/backend prisma:seed
```

Localities and amenities only. It upserts, so re-running is safe.

**Unverified:** the seed script runs through `ts-node`, which is a
devDependency and is not in the production image. Either run it from a machine
with the repository checked out and `DATABASE_URL` pointed at production, or
compile the seed. Doing it from a laptop is acceptable once; it is not a habit
to keep.

### 5. Web

Vercel, root directory `apps/web`. It detects Next.js. Set the two variables
above and deploy.

### 6. Point CORS at the real URL

Vercel gives the domain only after the first deploy, so `CORS_ORIGINS` is
usually set on a second pass.

---

## Rollback

**API.** Railway keeps previous deployments; redeploy the last good one. This is
safe **only if the migration in between was additive**. A migration that drops or
renames a column cannot be rolled back by redeploying the old image — the old
code will query a column that no longer exists. Every migration so far has been
additive.

**Web.** Vercel promotes any previous deployment instantly.

**Database.** Restore from backup. See below — this is the weakest part.

---

## Backups — the gap

Railway offers Postgres backups on paid plans. Turn them on before taking a
single real payment.

**A backup nobody has restored is not a backup.** Before launch:

1. Take a backup.
2. Restore it into a scratch database.
3. Confirm the row counts for `bookings`, `payments` and `invoices` match.
4. Write down how long it took.

Tenant payment records are the data you cannot recreate from anywhere else.

---

## Still missing

Not blockers for a first deploy, but each is a real gap:

- **No CI.** Nothing runs typecheck or tests before a deploy. A green pipeline
  gating the default branch is the next infrastructure work.
- **No error tracking.** A failure in production is currently invisible unless
  somebody reads the logs.
- **No alerting** on the things that lose money quietly: payment webhook
  failures, the no-show settlement sweep failing, release calls to Razorpay
  erroring.
- **No staging environment.** The first real Razorpay transaction will happen in
  production unless one is created.

---

## Fixed during this audit

- `package.json` started the API with `node dist/main.js`. Nest compiles to
  `dist/src/main.js`, so the production start command had never worked — only
  `pnpm dev` was ever used.
- The app listened on the default interface. A container binding loopback is
  unreachable from outside itself and the health check never passes.
- No `trust proxy`. Behind Railway every request arrives from the proxy address,
  so the 120-a-minute rate limit would have applied to all users combined rather
  than per person.
- The Prisma CLI was a devDependency, so the production image could not run
  migrations.

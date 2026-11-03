# Tienda Online

Open-source, fully customizable e-commerce: a customer storefront plus an admin panel, built to fit any kind of business. Only the brand, products and content change — not the system.

> UI language: Spanish (Paraguay-oriented defaults: PYG currency, bank transfer). Code and docs: English.

## Features

**Storefront**
- Catalog with search, categories/subcategories, price-range filter, product page with similar products
- Cart and favorites (client-side), customer accounts (email/password and Google Sign-In), password reset by email
- Saved addresses, shipping or pickup, coupon codes
- Checkout with **Stripe** (hosted Checkout) or **bank transfer** with receipt (comprobante) upload
- Order tracking with progress bar; works on desktop and mobile

**Admin panel** (`/admin`)
- Dashboard with KPIs
- Products (prices, stock, minimum stock, images, variants, unit/pack pricing), categories, suppliers, restocks
- Orders (manual payment confirmation, status changes), coupons
- Users with roles (Super Admin and others) and email invitations
- Reports with Excel (`exceljs`) and PDF (`pdfkit`) export
- **Settings editable without touching code**: branding, logo, hero, colors, themes/design variants (editable palettes), bank details, payment methods, "About us" page
- Weekly email report (low stock, best/worst sellers) with configurable day and time

Settings live in the database, so changes show up instantly, with no redeploy.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Backend | Node.js, Express, TypeScript, Zod, Helmet, express-rate-limit |
| Database | PostgreSQL 14+ via Prisma ORM (migrations included) |
| Auth | JWT (access + refresh), bcrypt, Google Identity Services |
| Payments | Stripe (Checkout + webhook), bank transfer |
| Email | Brevo transactional API (optional) |
| Files/reports | Multer + Sharp (images), ExcelJS, PDFKit, node-cron |

Monorepo with npm workspaces (`backend/`, `frontend/`, a single root `package-lock.json`).

## What you need to run it

| Requirement | Required? | Used for | Variable(s) |
|---|---|---|---|
| Node.js 20+ and npm | Yes | Run everything | — |
| PostgreSQL 14+ | Yes | All data | `DATABASE_URL` |
| Two random secrets | Yes | Signing sessions | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| Stripe account | Optional | Card payments (without it, only bank transfer) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Google OAuth Client ID | Optional | "Sign in with Google" | `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| Brevo account + verified sender | Optional | Invitations, password reset, order and weekly report emails (without it, emails are logged to the console) | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` |
| Persistent disk/volume | Yes in production | Uploaded images and receipts | `UPLOAD_DIR` |

Nothing in this repository contains real credentials. Every secret comes from environment variables.

## Quick start (local)

```bash
git clone <your-fork-url> tienda-online && cd tienda-online
npm install

# 1. Database (Docker). Or point DATABASE_URL to any PostgreSQL.
docker compose up -d

# 2. Environment
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Edit backend/.env: set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (see below)

# 3. Schema + initial data
npm run db:migrate
npm run prisma:seed --workspace backend

# 4. Run (two terminals)
npm run dev:backend     # http://localhost:4000
npm run dev:frontend    # http://localhost:3000
```

Generate the JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open `http://localhost:3000` for the store and `http://localhost:3000/admin/login` for the admin panel. The seed creates a Super Admin from `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` (defaults `admin@tienda.com` / `CambiarEsta123!`). **Set your own values before seeding, and change the password after first login.**

## Environment variables

### `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | `development` / `production` |
| `CORS_ORIGIN` | `http://localhost:3000` | Public URL of the frontend |
| `STORE_APP_URL` | `http://localhost:3000` | Storefront URL (Stripe success/cancel redirects). Keep equal to `CORS_ORIGIN` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — (required, 16+ chars) | Must be different from each other |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `30d` | Token lifetimes |
| `GOOGLE_CLIENT_ID` | empty | Google Sign-In (disabled if empty) |
| `STRIPE_SECRET_KEY` | empty | Stripe secret key (card payments disabled if empty) |
| `STRIPE_WEBHOOK_SECRET` | empty | Webhook signing secret (`whsec_...`) |
| `STRIPE_CURRENCY` | `pyg` | ISO currency code |
| `BREVO_API_KEY` | empty | Brevo API key (emails only logged if empty) |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | — / `Tienda Online` | Sender shown to recipients |
| `UPLOAD_DIR` | `./uploads` | Where images and receipts are stored |
| `PUBLIC_UPLOAD_BASE_URL` | `http://localhost:4000/uploads` | Public URL for uploaded files |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | see above | First admin created by the seed |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Public URL of the backend API |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same value as `GOOGLE_CLIENT_ID` |

`NEXT_PUBLIC_*` variables are embedded at build time: rebuild the frontend after changing them.

## Setting up the external services

### Google Sign-In (optional)
1. [console.cloud.google.com](https://console.cloud.google.com) → Auth Platform → Clients → Create client → *Web application*.
2. Add your frontend URL under *Authorized JavaScript origins* (e.g. `http://localhost:3000`).
3. Put the Client ID in `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Only the Client ID is needed (no secret, no redirect URI): ID tokens are verified server-side with `google-auth-library`.

### Stripe (optional)
1. Get the **secret key** from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/test/apikeys) (start in test mode). The publishable key is not needed: the app redirects to Stripe's hosted Checkout.
2. Set `STRIPE_SECRET_KEY`.
3. Webhook (auto-confirms card payments). Locally: `stripe listen --forward-to localhost:4000/api/store/stripe-webhook` and use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET`. In production, create a webhook endpoint in the Stripe dashboard pointing to `https://<your-api>/api/store/stripe-webhook`. Without the webhook, an admin confirms card payments manually from the panel.

### Brevo email (optional)
1. Create an account at [brevo.com](https://www.brevo.com) → SMTP & API → generate an API key → `BREVO_API_KEY`.
2. Add and verify a sender (Settings → Senders, Domains & Dedicated IPs → Senders). Brevo emails a confirmation link to that address. Use it as `BREVO_SENDER_EMAIL`.
3. If you own a domain, authenticate it (DKIM/DMARC) in the same section for better deliverability. Free-mail senders (Gmail, Yahoo…) cannot be DKIM-authenticated.

Without a key, the mailer just logs emails to the console, so nothing else breaks.

## Deploying to production

Any host works: a VPS, Coolify, Railway, Render, Fly.io, Docker, etc. You need two Node processes, a PostgreSQL database, and persistent storage for uploads.

**Backend**
```bash
npm ci
npm run build --workspace backend         # tsc + tsc-alias
npx prisma generate --schema backend/prisma/schema.prisma   # must run BEFORE the build if your host builds in steps
npm run prisma:deploy --workspace backend  # apply migrations
npm run start --workspace backend          # node dist/server.js
```

**Frontend**
```bash
npm run build --workspace frontend
npm run start --workspace frontend         # next start (use -p to choose the port)
```

Production checklist:
- [ ] Unique, long `JWT_*` secrets (never reuse across environments)
- [ ] `CORS_ORIGIN`, `STORE_APP_URL`, `PUBLIC_UPLOAD_BASE_URL` and `NEXT_PUBLIC_API_URL` point to your public HTTPS URLs
- [ ] `UPLOAD_DIR` is on a persistent volume (containers are ephemeral)
- [ ] `prisma migrate deploy` runs on every release
- [ ] Seed run once, with your own admin email/password
- [ ] Stripe webhook registered and `STRIPE_WEBHOOK_SECRET` set (if using Stripe)
- [ ] Database backups configured
- [ ] Frontend is rebuilt when any `NEXT_PUBLIC_*` variable changes

**Monorepo note:** there is a single `package-lock.json` at the repo root. If your platform builds each app separately, set its base directory to the repository root and `cd backend` / `cd frontend` inside the build and start commands.

## Project structure

```
backend/
  prisma/          schema.prisma, migrations, seed.ts
  src/
    routes/admin/  admin panel API
    routes/store/  storefront API (products, cart, checkout, Stripe webhook…)
    lib/           mailer, jwt, stripe, report cron, image processing…
frontend/
  app/(store)/     storefront pages
  app/admin/       admin panel pages
  components/      shared UI components
  lib/             API clients and types
docker-compose.yml PostgreSQL for local development
```

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev:backend` / `dev:frontend` | Development servers |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:studio` | Prisma Studio (DB browser) |
| `npm run prisma:seed --workspace backend` | Seed initial data |
| `npm run typecheck --workspace backend` / `frontend` | Type checking |

## Customizing

Most customization needs no code: log in to `/admin`, open **Configuración**, and edit brand, logo, hero, colors/theme, bank details, payment methods and the About page. Replace the sample catalog in `backend/prisma/seed.ts` (categories, products) or delete it and create your own in the panel.

## Security notes

- Rotate any key that was ever committed or shared; use test-mode Stripe keys until you go live.
- Change the seeded admin password immediately.
- The API uses Helmet, rate limiting and Zod input validation; keep dependencies updated.

## Contributing

Issues and pull requests are welcome. Please open an issue first for large changes, and never commit `.env` files.

## License

[MIT](LICENSE)

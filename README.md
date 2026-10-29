# Pashe Achi (পাশে আছি)

A bilingual (Bangla/English) service app with four services: কাঁচা বাজার, বাসা বদল, জরুরী ঔষুধ and পণ্য আদান প্রদান.

It is one project that runs as one server on one port. `npm run dev` starts everything at **http://localhost:3000**:

| Address | What it is |
|---|---|
| http://localhost:3000 | Customer site |
| http://localhost:3000/admin | Admin panel |
| http://localhost:3000/api/v1 | REST API (NestJS, Prisma, PostgreSQL) |
| http://localhost:3000/api/docs | API documentation (Swagger) |

The project has one `package.json`, one `node_modules` and one `.env`, all in this folder.

## Requirements

- Node.js 20.19 or newer (24 recommended).
- PostgreSQL 14 or newer, with a **UTF8** database. Bangla text needs it.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database. On Windows, PostgreSQL creates databases in the system code page unless told otherwise, so set UTF8 explicitly:

   ```sql
   CREATE DATABASE pashe_achi ENCODING 'UTF8' TEMPLATE template0;
   ```

   If you don't have PostgreSQL installed, `docker compose up -d` starts one with user `pashe` and password `pashe`.

3. Copy `.env.example` to `.env`, then set:
   - `DATABASE_URL`, with your PostgreSQL user and password
   - two different random secrets of at least 32 characters
   - the first admin's mobile and password in `SEED_ADMIN_*`

   To generate a secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. Create the tables and the first data:

   ```bash
   npm run db:migrate
   npm run db:seed                # pricing, vehicles, support line, super admin
   npm run db:seed:demo           # optional demo customer 01811111111 / demo1234 with three orders
   ```

5. Start the server:

   ```bash
   npm run dev
   ```

Sign in to the admin panel at http://localhost:3000/admin with the `SEED_ADMIN_MOBILE` and `SEED_ADMIN_PASSWORD` from your `.env`. Then change the support phone and WhatsApp numbers under **Pricing & vehicles**.

## Everyday commands

```bash
npm run dev            # the server, with hot reload
npm run typecheck      # check all TypeScript
npm test               # unit tests
npm run test:e2e       # API end-to-end tests (uses <your database>_test)
npm run build          # production build
npm start              # run the production build (one server, port from PORT in .env)
npm run db:studio      # browse the database
```

## How it fits together

- **Orders.** Customers place orders on the site. The API recalculates every fee from the current prices, and each order keeps its own copy of the prices it was placed with.
- **Admin.** The admin panel receives new orders instantly through Socket.IO, with a toast and a sound. Admins move orders through Pending, Booked, In progress, Completed and Cancelled, and can correct bazar or medicine prices.
- **Customer updates.** Every status or bill change notifies the customer instantly, with a bell and a toast. It also appears in their order history.
- **Roles.** Operators handle orders. Managers also edit prices, block customers and send announcements. The super admin also manages staff.

## Hosting

Run `npm run build`, then `npm start` on any Node.js server, behind a reverse proxy (for example Nginx) that serves HTTPS and passes WebSocket upgrades through. Set `PORT` in `.env` if 3000 is taken.

- **Backups.** The admin panel's System page (`/admin/system`) downloads a full database backup made with `pg_dump`. Install the PostgreSQL client tools on the server (Debian/Ubuntu: `apt install postgresql-client-17`; the version must be the database's or newer), or set `PG_DUMP_PATH` in `.env`. Restore a backup with `pg_restore --clean --if-exists --no-owner -d <database> <file>.dump`.
- **APK uploads.** The System page also uploads a new app APK (up to 150 MB), so let the proxy accept large bodies on that route (Nginx: `client_max_body_size 200m;`).

The site has its own server (NestJS serves the pages too), so it can't be hosted on Vercel.

## Mobile app (Flutter)

The Kingfisher app for Android and iPhone is in `mobile/`. It uses the same API as the website. `mobile/README.md` covers:
- building the APK and the Google Play bundle
- the signing key
- turning on push notifications
- the Google Play and App Store checklists

- **Login.** Log in with `POST /api/v1/auth/login`. Send `Authorization: Bearer <tokens.accessToken>` on every request, and renew with `POST /api/v1/auth/refresh` and `{ "refreshToken": "…" }` in the body.
- **Realtime.** Connect Socket.IO to the `/ws` namespace with `auth: { token: <accessToken> }`, and listen for `notification:new` and `order:updated`.
- **Push.** The app registers its Firebase token with `PUT /api/v1/notifications/device`. The server sends through Firebase Cloud Messaging once `FCM_SERVICE_ACCOUNT` is set in `.env` (see `.env.example`).
- **Download.** The website's `/app-download` page offers the APK uploaded on the admin panel's System page (`/admin/system`), or else `public/downloads/kingfisher.apk`.
- **Policies.** The privacy policy is at `/privacy`, and account deletion is explained at `/account-deletion` (the app's Profile has the same Delete account button as the website's).

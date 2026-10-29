# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pashe Achi (পাশে আছি, "we're by your side") is a bilingual (Bangla/English) service app. It has four services: কাঁচা বাজার (fresh market), বাসা বদল (house shifting), জরুরী ঔষুধ (emergency medicine) and পণ্য আদান প্রদান (parcel delivery).

It is **one project that runs as one server on one port** (3000 by default):

| URL | What answers it |
|---|---|
| `/`, `/home`, `/bazar`, `/orders`, … | Customer site (Next.js 16), phone-first |
| `/admin`, `/admin/orders`, … | Admin panel (the same Next.js app, styled with Tailwind) |
| `/api/v1/…` | NestJS 11 REST API (Prisma 7, PostgreSQL) |
| `/api/docs`, `/api/docs-json` | Swagger UI and the OpenAPI document |
| `/socket.io/` (namespace `/ws`) | Socket.IO realtime notifications |

- **Wording.** The customer site started as a v0.app prototype drawn from the owner's hand-drawn Bangla sketches. Labels in Bangla mode match the sketch wording exactly, including the English words the sketches use (Loading Area, Total Bill, Total cost, Chat, Call, point).
- **Mobile app.** The Kingfisher app (Flutter, Android and iPhone, id `com.kingfisherbd24.app`) is in `mobile/` and uses the same API, `https://kingfisherbd24.com/api/v1`, with `Authorization: Bearer`. So the API stays REST, versioned and documented, and it accepts Bearer tokens as well as cookies. `mobile/README.md` covers building, the signing key, push, and the Play Store and App Store checklists.

## One of everything (owner's explicit requirement)

The project has one `package.json`, one `node_modules`, one `.env`, one port, and a flat layout. Don't reintroduce `apps/` or `packages/`, workspaces, Turborepo, per-folder `package.json` or env files, or a second server or port.

- Add dependencies to the root `package.json` at **exact** versions. The package manager is npm; don't add a pnpm or Yarn lockfile.
- `.env` (gitignored) at the root holds every setting, and `.env.example` is the committed template. `src/server/config/env.ts` validates it at boot and lists every problem at once.
- `mobile/` is the Flutter app, with its own `pubspec.yaml` (Dart, not npm). It is a separate client of the API, not a JS workspace; nothing in the JS toolchain reads it (Jest ignores it).

## Commands

```bash
npm install
npm run dev          # the one server, with hot reload for pages and a restart on src/server or src/shared changes
npm run build        # prisma generate, next build (pages; type-checks the whole project), nest build (dist/server)
npm start            # production: node dist/server/main.js, serving the .next build
npm run typecheck    # tsc for everything, then tsc -p tsconfig.build.json (the server's CommonJS settings)
npm test             # Vitest (src/shared) + Jest unit tests (src/server/**/*.spec.ts)
npm run test:e2e     # test/*.e2e-spec.ts: the Nest app against a real PostgreSQL test database
npm run db:migrate   # prisma migrate dev (creates a migration); then npm run db:generate
npm run db:deploy | db:seed | db:seed:demo | db:studio | db:generate
```

- **The app.** Its commands (`flutter test`; the website's APK with `-P websiteApk=true`, ARM only and compressed, about 22 MB; the Play bundle), the portable toolchain in `E:\kingfisher-dev` and the `kingfisher16k` emulator are in `mobile/README.md`; `.github/workflows/mobile.yml` builds it on GitHub too.
- **Single test file.** `npx vitest run src/shared/pricing.test.ts`, or `npx jest src/server/auth/cookies.spec.ts`.
- **Dev vs production.** `npm run dev` runs `nest start --watch -- --dev`. That `--dev` flag, not `NODE_ENV`, puts Next.js in dev mode. `src/server/load-env.ts` then sets `NODE_ENV` to development or production to match, unless the environment already sets it.
- **e2e database.** `test:e2e` uses `TEST_DATABASE_URL`, or `DATABASE_URL` with `_test` appended. It creates that database (UTF8), migrates it, and truncates it on every run. It runs Jest through `node --experimental-vm-modules`, because the Prisma 7 client loads its query engine with dynamic `import()`. The e2e tests boot the API alone, through `configureApp`, without the pages.
- **Seed.** `prisma/seed.ts` is idempotent: catalog defaults, the built-in roles (`BUILT_IN_ROLES`: Super admin, Manager, Operator and the presets Customer support, Pricing desk, Dispatcher, Marketing, Accounts and Staff admin; each created if missing, with a history entry, skipped if a panel-made role already has its English name, and never overwritten, though a deleted preset comes back on the next seed) and the first super admin (from `SEED_ADMIN_*` in `.env`), each with a SYSTEM history row. `npm run db:seed:demo` adds `prisma/seed-demo.ts`: a deterministic month of data relative to today. It has a demo manager (01822222222), an operator (01833333333) and 8 customers, among them 01811111111 with the prototype's three orders. Every demo password is demo1234. Alongside about 65 orders in every status (bazar, medicine and shifting through the quote → confirm flow, some with a higher delivery charge for a far address or a higher vehicle rent for a long move; the demo customer's medicine order waits for their confirm), it writes timelines, history entries and notifications, two running offers, plus a map location for every customer (one pin per area; their orders carry pins too). It runs in one transaction and skips if the demo customer exists.
- **Lint.** There is no lint script.

## Layout and request flow

```
src/
  server/      NestJS: main.ts, load-env.ts, bootstrap.ts and the modules; generated/ is the Prisma client (gitignored)
  app/         Next.js App Router: (customer)/ and (admin)/admin/ are two separate root layouts
  customer/    customer site screens: components/, features/, lib/
  admin/       admin panel: components/, lib/
  shared/      the contract every other folder uses (no framework code)
  api-client/  browser client (fetch + Socket.IO) used by the customer site and the admin panel
  proxy.ts     Next 16's name for middleware
prisma/  schema, migrations, seed.ts        test/  API e2e tests        public/  icons, downloads/kingfisher.apk
mobile/  the Kingfisher app (Flutter)      .github/workflows/mobile.yml  its cloud build
```

- **One port.** `src/server/main.ts` works in this order:
  1. It creates the Nest app.
  2. It creates Next with `next({ dev, dir: PROJECT_ROOT, httpServer })`.
  3. It registers a middleware **before** `configureApp`. That middleware hands every request outside `/api` to Next's request handler, so pages never pass through helmet, the body parsers or the pino request log.
  4. Socket.IO (engine.io) catches `/socket.io/` on the HTTP server itself, before Express sees it.
- **Things that keep the one port working:**
  - `AppIoAdapter` in `bootstrap.ts` sets `destroyUpgrade: false`. Without it, engine.io closes Next's hot-reload WebSocket.
  - The matcher in `src/proxy.ts` excludes `api/` and `socket.io/`. Next runs route resolution, including the proxy, for every WebSocket upgrade, and a redirect there would break Socket.IO.
  - `configureApp` turns off Express's `x-powered-by` app-wide, because pages skip helmet.
  - A custom server like this can't be deployed to Vercel and can't use `output: 'standalone'`. Run it with `npm start` on any Node host.
- **Aliases.**
  - `@/*` maps to `src/*`. One `tsconfig.json` serves the editor, `tsc` and `next build`, with decorators enabled.
  - Server code imports only `@/shared` and relative paths, never customer, admin or api-client code.
  - `nest build` uses `tsconfig.build.json`: CommonJS, `rootDir: src`, and `incremental: false`, because incremental builds combined with `deleteOutDir` emitted nothing. It rewrites `@/shared` into relative requires, and the entry point is `dist/server/main.js`.
  - Jest maps `@/` with `moduleNameMapper`.
- **Paths.** `PROJECT_ROOT` (`src/server/project-root.ts`) is the repo root whether the code runs from `src/server` or `dist/server`. `.env`, `.next` and `UPLOAD_DIR` resolve against it.

### src/shared: the contract between the server, the customer site and the admin panel

- `schemas/*`: Zod 4 schemas for every request body. The API validates with them through `nestjs-zod`, and both front ends validate the same payload before sending.
- `enums.ts` / `labels.ts` also hold the history log's actions, record types and field labels (`AUDIT_*`).
- `messages.ts`: every user-facing error as a `MessageCode` with `{ bn, en }` text.
  - Schemas use codes as their messages, and the API returns `{ statusCode, code, message: { bn, en }, issues? }`.
  - `FORM_ERROR_PRIORITY` with `pickIssueCode` / `validateForm` makes each form show one message, in the original screens' order.
  - Add new error text here, never inline.
- `pricing.ts`: `calcBazar`, `calcShifting` and the other calculators. The customer bill preview and the API use the same functions. The API never trusts client totals. Each order stores a snapshot (`itemsTotal`, `serviceFee`, `deliveryFee`, `total`), so price changes never alter old bills.
- `delivery-hours.ts`: the delivery hours per service, set by managers in Catalog and stored as `Setting` rows (`delivery.bazar` = `08:00-10:00,18:00-21:00`; empty means no notice). `deliveryHoursNotice` builds each screen's "… ডেলিভারির সময় সূচী" notice from them (the defaults reproduce the sketch sentence). They only inform (owner's rule): the customer may pick any ডেলিভারি টাইম, all 24 hours, and neither the forms nor the API check it against the hours.
- `enums.ts`: services, statuses, `ORDER_TRANSITIONS` and `adminNextStatuses` (the moves staff may make), `QUOTED_SERVICES` / `isAwaitingPrice` (bazar, medicine and shifting's vehicle rent are priced by staff), `CUSTOMER_CANCELLABLE`, `QUOTE_EDITABLE`, `REVENUE_STATUSES` / `isRevenue` (the bills that count as revenue: BOOKED, IN_PROGRESS, COMPLETED), `ORDER_SORTS`, `CUSTOMER_SORTS`, `OFFER_STATUSES`, roles, `API_PREFIX` (`api/v1`), `SOCKET_NAMESPACE` and `SOCKET_EVENTS`.
- `labels.ts`: bilingual service and status labels.
- `brand.ts`: app name, logo paths, `PA-` order prefix and the banner photos.
  - The logo source is the transparent `public/logo/logo.png`, a kingfisher with no wordmark, so the name shows as text beside it. `logo-mark`/`logo-256`/`logo-512`, the icons and `public/og-image.jpg` (the share banner) are made from it, so re-render them if the logo changes.
  - `DEVELOPER` / `DEVELOPED_BY` are the developer credit ("Developed by Aethrasoft", linking to aethrasoft.com). `DeveloperCredit` (`src/customer/components/developer-credit.tsx`, `.dev-credit` CSS; `src/admin/components/developer-credit.tsx`) shows it in the landing footer, the sign-in and welcome screens and both sidebars.
  - `APP_DOWNLOADS` (`playStore`, `apk`) are the Android app's links on `/app-download`. `null` shows "শীঘ্রই আসছে" in place of the button; set a link and redeploy to switch it on. `apk` is `APK_DOWNLOAD_PATH` (`/api/v1/app/apk`, the System page's APK, see below); `playStore` stays `null` until the app is published.
  - `PHOTOS` and `photo(name)` give the `src`/`srcSet` of the photos in `public/images` (`{name}-800.webp` and `-1600.webp`, Unsplash License, sources listed in the file). `CATEGORY_PHOTOS` / `categoryPhoto(name)` are Home's category photos (`cat-{name}-400.webp` and `-800.webp`, 4:3; the app bundles the 400 px files).
- `geo.ts`: `GeoPoint`, `DHAKA_CENTER`, `joinAddress` (details, then the map address, as one line) and `mapLink` (a Google Maps URL, no key, for staff and riders to open a pin). `schemas/locations.ts` has `customerLocationSchema` (the customer's one location, and the value of every address box) and `requiredPin` (the order pins `addressPin`, `loadingPin`/`unloadingPin`, `pickupPin`/`dropoffPin`, all required).
- `schemas/offers.ts`: আজকের অফার (`offerSchema`, `updateOfferSchema`); `OfferDto` / `AdminOfferDto` are in `types.ts`.
- `types.ts`: response DTOs.

### src/server (the API)

- **Modules:**
  - `auth` (customer and admin)
  - `users` (`/me`, `/me/location`, `DELETE /me`, `/admin/customers`)
  - `admins` (`/admin/staff`)
  - `catalog` (pricing, vehicles, support line, delivery hours)
  - `uploads`
  - `orders`
  - `notifications`
  - `offers` (আজকের অফার: public `/offers`, `/admin/offers`)
  - `dashboard`
  - `audit` (the history log, `/admin/audit`)
  - `geo` (`/geo/reverse`: address text for a map pin, public)
  - `system` (`/admin/system`: database backup and the app's APK; public `/app/apk`)
  - `health`
- **Request DTOs.** All of them are in `common/dto.ts`, wrapping the shared schemas.
- **Admin lists and their stats.**
  - Every `/admin/*` list (orders, customers, audit, notifications, staff, offers) is numbered pages: `page`/`limit` (`pageQuery`, default 25, at most 100) in, `PagedList` (`items`, `total`, `page`, `limit`, `pageCount`) out. Use `offsetArgs`/`toPaged` from `common/pagination.ts` with `findMany` and `count` in one `$transaction`, and end every `orderBy` with `id` so pages never overlap. The customer endpoints (`/orders`, `/notifications`) stay on cursors (`Paginated`, `pageArgs`/`toPage`), for the site and the Flutter app.
  - Each list has a `GET …/stats` taking the same filters minus the one its tabs or tiles split by (status, actor type, unread, blocked/ordered), so every tab shows its count. Declare `@Get('stats')` before `@Get(':id')`.
  - Date filters are `from`/`to` Bangladesh days, inclusive (`bdDayRange`); a reversed range is `range.invalid` (`orderedRange`/`rangeError` in `schemas/common.ts`). Orders can filter by delivery day instead (`dateBy=scheduled`).
  - **Revenue counts only confirmed bills** (`REVENUE_STATUSES`), everywhere: `orderTotals` in `orders/order-stats.ts` builds counts per status, revenue, completed revenue, average bill and cancellation rate from one `groupBy` on status.
  - **Dashboard.** `GET /admin/dashboard?from&to` (or `days`, default 7; at most 366 days, ending today at the latest; `dashboardRange`/`previousRange` in `schemas/admin.ts`) returns the period's totals beside the period of the same length just before it (`current`/`before`), the live queue, the period by status and service, a series by day (by week beyond 92 days) and the top 5 customers by confirmed spend. `GET /admin/dashboard/staff` (`dashboard.staff_activity`) counts each staff member's order status changes, prices sent and completions in the period.
- **Errors.** Throw `AppException.badRequest('code')` and similar. `common/all-exceptions.filter.ts` shapes every error, including Prisma P2002/P2025.
- **Auth:**
  - Customers (`User`) and staff (`Admin`) are separate tables, with separate JWT secrets and separate cookies. Customers get `pa_at` / `pa_rt`; admins get `pa_admin_at` / `pa_admin_rt`. Both live on the one origin with path `/`.
  - Access tokens are 15-minute JWTs.
  - Refresh tokens are random strings stored as SHA-256 hashes. They rotate on every use. A replayed token, outside a 30-second grace window, revokes its whole family (`auth/token.service.ts`).
  - Customer sessions never expire. Their refresh tokens have a null `expiresAt`, and the `pa_rt` cookie lasts 400 days (the browser maximum) and is renewed on every refresh. They end only on logout, a password change, a block, an account deletion or a replay. Admin sessions end after `REFRESH_TOKEN_TTL_DAYS`.
  - Sign-up and login use `AuthThrottle` (`AUTH_THROTTLE_LIMIT` per minute and IP). The customer `POST /auth/refresh` uses only the global limit: a refresh token can't be guessed, and phones on mobile data share a few carrier IPs, so a strict limit there would sign app users out.
  - **Customer password switch (owner's rule).** The `Setting` row `auth.customerPassword` (`on`; missing or anything else is off) decides whether customers need a password. Changing it needs `catalog.customer_signin`, which only the Super admin has at first (`PUT /admin/catalog/customer-auth`, the Catalog page's "Customer sign-in" card, history `CUSTOMER_AUTH_UPDATED`). `GET /catalog` carries it as `customerAuth.password`, and the sign-in screens show the password box and Profile's Change password only while it is on.
    - Off (the default): signup takes no password and stores the mobile number as one; login takes the mobile number alone for **every** customer (`auth.no_account` for an unknown number). Anyone who knows a number can open that account, so an SMS code (OTP) is the planned replacement.
    - On: signup and login need the password (`password.required`); accounts opened while it was off log in with their mobile number as the password. Staff login always needs a password.
  - `CustomerGuard` and `AdminGuard` re-read the account (and the admin's role) on every request, so blocking someone, deactivating them or changing their role's permissions takes effect on the next request.
  - **Deleting an account (`DELETE /me`; a Google Play and App Store rule).** Refused while an order is PENDING, QUOTED, BOOKED or IN_PROGRESS (`account.active_orders`, `ACTIVE_ORDER_STATUSES`). `UsersService.deleteAccount` works in one transaction:
    - The `User` row stays, emptied, because orders point to it: name `Deleted customer`, mobile `deleted-<id>` (so the number can sign up again), location cleared, an unusable password, `deletedAt` set.
    - Refresh tokens, push subscriptions, device tokens, notifications and uploads are deleted; the prescription files go after the commit.
    - The customer's orders keep their number, service, lines, bill and timeline as sales records; their addresses, pins, phone numbers and notes, and the shifting and parcel summaries (which name the addresses), are cleared.
    - History: `CUSTOMER_DELETED`. The `customerDeleted` event closes the customer's sockets.
    - Afterwards `CustomerGuard` and the gateway refuse the account (401); the admin customers list, its stats, the dashboard's customer count and `notifyUsers('all')` skip it; `AdminCustomerDto.deleted` shows a badge on the customer page and hides block and points. The app, the website's Profile and `/account-deletion` all offer it.
  - **Roles are data (owner's rule: fully dynamic).** Each admin has one `Role` row (`Admin.roleId`); a role is two names, optional descriptions and a list of `module.action` permissions. The matrix is `PERMISSION_MODULES` in `src/shared/permissions.ts` (dashboard, orders, customers, catalog, offers, notifications, history, staff, roles, system); any action also grants its module's `view` (`normalizePermissions`). Labels and hints are `PERMISSION_MODULE_LABELS` / `PERMISSION_LABELS` in `labels.ts`.
    - Routes declare what they need with `@Can('orders.send_price')` (on the class, or on a route, which replaces the class's). Where one route covers two permissions the controller or service checks `can()` itself: customer PATCH (`customers.block` for `isBlocked`, `customers.edit_points` for `points`) and staff PATCH (`staff.edit`, `staff.reset_password` for `password`). `AdminPrincipal` carries `role` (`RoleRef`) and `permissions`; `AdminDto` (login, `/me`) carries the same, so the panel checks `can(admin, …)` too.
    - **The system role** (`isSystem`, key `super_admin`, "Super admin") has every permission, including ones added later, and is never edited or deleted (`role.locked`). Roles are managed by staff holding `roles.create`/`roles.edit`/`roles.delete` (the Roles & permissions module, which no preset has: the Super admin ticks it); `GET /admin/roles` is open to any admin for names and pickers. Anyone but the Super admin gives or takes away only permissions they hold (`role.beyond_own`), so nobody grants more than they have, and never changes their own role (`role.own`). A role is deleted only when no admin holds it (`role.in_use`); English names are unique (`role.name_taken`).
    - **No escalation:** only a Super admin may give or take the Super admin role, or change a Super admin's account (`admin.super_only`); the last active Super admin can't lose the role or be disabled (`admin.last_super`); nobody changes their own role or disables themselves (`admin.self`).
    - The `dynamic_roles` migration turned the old enum into the built-in roles `role_super_admin`, `role_manager` and `role_operator` with the permissions those roles had (`MANAGER_PERMISSIONS`, `OPERATOR_PERMISSIONS`); the seed adds the other presets. `GET /admin/catalog` stays open to any admin (the order page needs the vehicles). Order notifications and the `admins` socket room go only to admins who can `orders.view` (`adminsWhoCan` in `roles/role.mapper.ts`).
    - To add a permission: add the action to `PERMISSION_MODULES`, its labels to `PERMISSION_LABELS`, `@Can()` on the route and `can()` in the panel. Existing roles don't get it until the Super admin ticks it.
- **Orders:**
  - `orders.service.ts` writes the order, its children and its first timeline event in one transaction.
  - Status changes use `updateMany where status = from`, so concurrent changes can't both win. Every change writes an `OrderStatusEvent`.
  - **Customers never send prices.** Parcel is priced from the Catalog when placed. Bazar, medicine and shifting (`QUOTED_SERVICES`) are placed with no prices (the bill is the fees only; for shifting, labour and floors from the Catalog, with `ShiftingDetail.vehicleRate` null):
    1. Staff send a quote. Bazar and medicine use `PUT /admin/orders/:id/quote` with the whole list of lines: they price every line, can remove lines and can add new ones (a prescription's medicines). They may also change the order's `serviceFee` (bazar's shopping fee) and `deliveryFee` from the Catalog's, e.g. for a far address; a fee left out stays as it is, and medicine has no shopping fee (`quote.fees`). Shifting uses `PUT /admin/orders/:id/shifting-quote` with the vehicle rent (`vehicleRate`, set by the distance between the two pins; the vehicle's Catalog `rate` is only its starting rate, shown to customers as "থেকে"), which becomes `itemsTotal`; labour and floors stay as placed. Both go through `sendQuote` in `orders.service.ts`. The order goes PENDING → **QUOTED**, `quoteVersion` goes up by one, and the customer is notified with the whole bill, the charges that changed (80 → 120) and the staff note.
    2. The customer confirms (`POST /orders/:id/confirm` with the `quoteVersion` and total they saw), which moves it QUOTED → BOOKED, or cancels.
    3. Staff may re-quote while QUOTED; after BOOKED the bill is locked (`order.bill_locked`).
    4. The quote locks the order row, and the confirm only applies while `quoteVersion` and the total are unchanged (`order.quote_changed`), so a customer never confirms a bill they have not seen, even a new one with the same total.
    5. Staff can't move a bazar, medicine or shifting order out of PENDING by status (`adminNextStatuses`).
  - After commit it emits domain events (`common/domain-events.ts`) through `@nestjs/event-emitter`: `orderCreated`, `orderStatusChanged`, and `orderQuoted` (with the bill before the quote and the note).
- **History log (`AuditLog`):**
  - Every change writes one row in the same transaction: `AuditService.record(entry, tx)`. Changes come from orders, bills, catalog, customers, staff, broadcasts, signups, profiles, and admin sign-ins and failed sign-ins.
  - Each row stores who did it, as snapshots: actor name and role, entity label, IP and user agent. It also stores only the changed fields (`diffChanges` in `audit/diff.ts`), plus a note and meta. No-op updates write nothing, and passwords are never stored.
  - Controllers pass the actor with `@Actor()` (or `clientInfo(request)` before sign-in). Add new actions to the Prisma enum, `AUDIT_ACTIONS`/`AUDIT_ACTIONS_BY_ENTITY` in `enums.ts`, the labels in `labels.ts`, and an icon in `ACTION_ICONS` (`src/admin/components/audit-feed.tsx`; the typecheck fails without it).
  - `GET /admin/audit` needs `history.view`; `GET /admin/orders/:id/history` needs `orders.view`. Admin entries snapshot the role name as `actorRole` (`{ bn, en }`); STAFF_* entries record the role by its English name (the old enum values, e.g. `MANAGER`, are named by `LEGACY_ROLE_NAMES`). Role changes are `ROLE_CREATED`/`ROLE_UPDATED`/`ROLE_DELETED` on entity `ROLE`, one `permission.added`/`permission.removed` change per permission.
  - The `audit_log` migration backfills history from `OrderStatusEvent`, users and admins.
- **Notifications:**
  - `notifications.listener.ts` turns those domain events into stored bilingual `Notification` rows, plus Socket.IO pushes.
  - The gateway is at namespace `/ws`. It authenticates in Socket.IO middleware, and rejected handshakes get `connect_error` "unauthorized". Sockets join the rooms `user:<id>`, `admin:<id>` and `admins`.
  - The wording is in `notification.content.ts` (plain functions, also used by the demo seed). Quote notifications carry the whole bill (`billBreakdown`) and the changed charges (`feeChanges`).
  - Delivery goes through the `NOTIFICATION_CHANNELS` list in `notifications.module.ts`: `RealtimeChannel` (Socket.IO), `WebPushChannel` and `FcmChannel`. Add SMS there.
  - **Push to the app (Firebase Cloud Messaging):**
    - On only when `.env` has `FCM_SERVICE_ACCOUNT` (the Firebase service-account key, as JSON or base64; `parseServiceAccount` in `config/env.ts` checks it at boot).
    - `DeviceToken` rows (token unique, one customer each, platform, lang, app version): `PUT/DELETE /notifications/device` (`deviceTokenSchema` in `schemas/push.ts`). Tokens are kept while FCM is off, so switching it on reaches phones that already have the app.
    - `fcm.sender.ts` signs the service-account JWT with `node:crypto` (no Google library), exchanges it for an access token (cached until 5 minutes before it expires) and POSTs FCM HTTP v1. `FCM_SENDER` is that call; the e2e tests replace it with a recorder.
    - `fcm.channel.ts` sends customer notifications in the background like Web Push: in the phone's language, on Android channel `orders` (ORDER_*, high priority) or `news`, with Web Push's tags (`order-<id>`, `offer-<id>`) and `data` (`notificationId`, `orderId`, `offerId`) for the tap. `UNREGISTERED` (404) deletes the token.
  - **Phone and desktop push (Web Push):**
    - On only when `.env` has `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (generate the keys with `npx web-push generate-vapid-keys`); otherwise `GET …/push` answers `{ publicKey: null }` and the switches are hidden.
    - `PushSubscription` rows, at most one customer and one admin owner per browser endpoint (`@@unique([endpoint, audience])`), so a shared phone follows whoever signs in. Routes: `GET/PUT/DELETE /notifications/push` and `/admin/notifications/push`. Endpoints must be on a known push service (`isPushEndpoint` in `schemas/push.ts`), so the server never posts to an arbitrary address.
    - `web-push.channel.ts` sends in the background (8 at a time, finished before shutdown), in the language the browser subscribed with, opening the customer site (`basePath` `''`) or `/admin` (the `mobile_app` migration moved the old `/app` rows to `''`). A 404/410 from the push service deletes the row. `PUSH_SENDER` (`push.service.ts`) is the `web-push` call; the e2e tests replace it with a recorder.
    - The browser side: `public/sw.js` (scope `/`, no fetch handler; skips the system notification when a tab of that side is focused, since the toast shows it; a tap focuses or opens the URL), `src/api-client/push.ts` (`enablePush`, `syncPush` on every load and language change, `disablePush`, `forgetPush` before logout), and `PushProvider`/`usePush` in `src/customer/lib/push.tsx` and `src/admin/lib/push.tsx`. Each side remembers its own choice in localStorage (`pa_push`, `pa_admin_push`).
    - Browsers allow push only on HTTPS (localhost works without it). iPhones and iPads get it only after Add to Home Screen, which `src/app/manifest.ts` (start URL `/home`) and the customer layout's `appleWebApp` make possible.
- **Prisma 7:**
  - `prisma.config.ts` (root) holds the datasource URL and loads `.env`.
  - The `prisma-client` generator writes to `src/server/generated/prisma`, which is gitignored. It uses `moduleFormat = "cjs"` and `importFileExtension = "js"`.
  - The client uses `@prisma/adapter-pg`.
  - `migrate dev` does not regenerate the client, so run `db:generate`.
  - The first migration restarts the order-number sequence at 1001.
  - The database must be **UTF8**, or Bangla writes fail, and `PrismaService` refuses to start otherwise. On Windows, create it with `CREATE DATABASE … ENCODING 'UTF8' TEMPLATE template0`.
- **Offers (আজকের অফার):** the `Offer` table, running from `startsOn` to `endsOn` (Bangladesh days) while `isActive`. Pictures (JPG, PNG or WebP, ≤5 MB, checked by magic bytes) go through the `StorageService` exported by `UploadsModule`, under `offers/…`. `GET /offers` and `GET /offers/:id/image` are public (the landing page), and `imageUrl` carries `?v=` so a replaced picture is never cached. Writes are for managers; `POST /admin/offers/:id/notify` sends an `OFFER` notification to every customer. History: `OFFER_*` on entity `OFFER`.
- **The customer's location and map pins (owner's rule: every location comes from the map, never typed):**
  - Each customer has **one** location (আমার লোকেশন) on the `User` row: `location` (the address the map gave), `locationDetails` (the house/flat/road they added) and `locationLat`/`locationLng`. Signup requires it (`customerLocationSchema`), and `PUT /me/location` replaces it with a `CUSTOMER_LOCATION_UPDATED` history entry (only when something changed). `CustomerDto.location` is null while there is no pin (text-only accounts from before). `PATCH /me` no longer takes a location. `CUSTOMER_LOCATION_ADDED`/`_DELETED` remain only for old history rows (the earlier list of saved places).
  - Every order address needs a pin (`requiredPin`, `location.required`). Orders copy the address text (`joinAddress`: details, then the map address) and the pin into the `*Lat`/`*Lng` columns (`Order.address*`, `ShiftingDetail.loading*`/`unloading*`, `ParcelDetail.pickup*`/`dropoff*`), which stay nullable for older orders, so changing the location never changes an old order.
  - `GET /geo/reverse` is public, because signup needs it before there is an account, with a per-IP throttle. It asks OpenStreetMap's Nominatim through the server so the whole app keeps to its policy: one lookup a second, an identifying User-Agent, a 500-entry cache. Any failure answers `{ address: null }`, and only then does the map sheet let the customer type the area's name (the pin is still required). Busy production use should move to a paid geocoder.
  - `formatAddress` (`geo/geo.service.ts`) writes the text finest to coarsest, the Bangladesh way: place name, বাসা/House number, road, then every area part Nominatim sends (housing area, sector or block, suburb …), then the city, or outside a city the upazila and district, with the postcode after the last part (`ঢাকা-১২৩১`). Road codes (`N5`) are dropped. In Bangla the house number and postcode get Bengali digits.
- **System (`system/`, the `system` permission module: `view`, `backup`, `apk`; no preset has it, so at first only the Super admin).**
  - `GET /admin/system` (`SystemStatusDto`): the database's name, size and PostgreSQL version, pg_dump's version (null when it can't run) and the live APK.
  - `GET /admin/system/backup` (`system.backup`): `backup.service.ts` runs `pg_dump --format=custom --no-owner --no-privileges` (`PG_DUMP_PATH`, default `pg_dump`; its major version must be the server's or newer) into a temp file, then streams it as `kingfisher-backup-<BD date>-<HHmm>.dump` and deletes it. The connection goes in the child's environment (`pgEnv` in `pg-env.ts`, dropping Prisma's `?schema=`), never its arguments. One at a time (`system.backup_busy`); `system.pg_dump_missing` / `system.backup_failed` (stderr only in the log). History `SYSTEM_BACKUP_DOWNLOADED`. The database only: the uploads folder isn't in it. Restore with `pg_restore --clean --if-exists --no-owner -d <db> file.dump`.
  - The APK (`apk.service.ts`): `PUT /admin/system/apk` (`system.apk`; multipart `file` up to `MAX_APK_BYTES` 150 MB, checked by `isApk` in `uploads/file-signature.ts`, plus an optional `version`, `apkUploadSchema`) stores it through `StorageService` under `app/…` (a new key each time) and names it in the `Setting` row `app.apk` (JSON); `DELETE` removes it. Public `GET /app/apk` serves the uploaded APK, or else the bundled `public/downloads/kingfisher.apk`, so a new build goes live without a redeploy. `next.config.mjs` redirects the old `/downloads/kingfisher.apk` there. History `APK_UPLOADED` / `APK_REMOVED` on entity `SYSTEM`.
  - The page is `/admin/system` (menu "System"); backups download through `http.download` (fetch with the 401 refresh, then a blob), not a plain link.
- **Uploads.** Prescriptions are checked by their magic bytes (`uploads/file-signature.ts`), not by MIME type. They are stored through the `StorageService` abstraction, currently `LocalDiskStorage` under `UPLOAD_DIR`. Customers can read only their own files; admins use `/admin/uploads/:id`.
- **Env.** In production, `config/env.ts` refuses the example secrets from `.env.example` (and an `example.com` `VAPID_SUBJECT`).
- **Dependency pins.** Stay on the NestJS 11 line: Nest 12 and `@nestjs/event-emitter` 12 are ESM-only. `nestjs-zod` needs Nest 11, and Jest can't load ESM-only packages. Keep `@nestjs/event-emitter` at 3.x.

### Pages: one Next.js app with two root layouts

- **Two root layouts.** `src/app/(customer)/layout.tsx` and `src/app/(admin)/layout.tsx` are separate root layouts, each with its own `globals.css`, providers and language cookie.
  - Moving between `/` and `/admin` is a full page load, so the customer CSS and the admin Tailwind theme never mix.
  - Each `globals.css` limits Tailwind's scan to its own side, with `source(none)` plus `@source`.
  - Unknown URLs get `src/app/global-not-found.tsx` (`experimental.globalNotFound`). The font is defined in `src/app/fonts.ts`.
- **`src/proxy.ts`.** Redirects based only on whether a session cookie exists. The API does the real auth check.
  - Under `/admin` it checks `pa_admin_rt` and redirects to `/admin/login`.
  - Everywhere else it checks `pa_rt` and redirects to `/login`, except the public `/`, `/app-download`, `/privacy` and `/account-deletion` (`PUBLIC_PATHS`).
  - `next.config.mjs` `redirects()` sends the old phone version's links on before the proxy runs: `/app` → `/home`, `/app/…` → `/…` (permanent; `/app-download` is a different path).
- **Calling the API.** Both front ends call the API on their own origin: the base is `/${API_PREFIX}`, and Socket.IO connects with `io(SOCKET_NAMESPACE)`. There is no API URL setting and no CORS.

### Customer site (src/customer, src/app/(customer))

- **One site, phone-first.** The desktop layout from 1024px, the phone layout below it. The phone version that lived under `/app` became the Kingfisher app (`mobile/`); its old links redirect to the same pages here.

  | Public | Signed-in screens (`(web)/…`) |
  |---|---|
  | `/` (landing, `features/landing.tsx`), `/app-download` (the app's links, `features/download.tsx`, with the Chat/Call dock at every width), `/privacy` and `/account-deletion` (`features/legal.tsx`: reading pages in the landing's look, contact details from the live Catalog), `/login`, `/signup` | `/home`, `/bazar`, `/shifting`, `/medicine`, `/parcel`, `/orders`, `/orders/[id]`, `/notifications`, `/offers`, `/profile` |

  - **The landing page.** It has a deep indigo hero. Its one bold element is `components/service-switcher.tsx`, an ARIA tablist of the four services. Each tab shows that service's photo, its live Catalog charges and delivery hours, and an order link.
    - The sections after the hero:
      - a promises strip;
      - আজকের অফার from the public `GET /offers`, while an offer runs;
      - a services bento;
      - how it works, beside `QuotePreviewCard` (an example price card marked "Example");
      - the app, shown as a real screenshot `public/images/app-{bn,en}.webp` in a phone frame;
      - a pricing ledger;
      - the FAQ;
      - the closing band.
    - Every number on the page is live; there are no made-up reviews or counts.
    - From 1024px the floating dock shows App (to `/app-download`, via `ContactDock`'s `appHref`), Chat and Call. Below 1024px a sticky bar (Sign up, App, Chat, Call) replaces it.
    - Headlines use Anek Bangla (`displayFont` in `src/app/fonts.ts`). Only the landing root carries its variable, passed from `app/(customer)/page.tsx`.
    - Its CSS is the "Landing page" section, with `lp-` classes.
    - Signed-in visitors see "Open app" in place of Sign up / Login.
  - Build every customer URL with `usePaths()` / `webPaths` from `lib/paths.tsx`, never a string literal.
  - `src/proxy.ts`: signed out, a screen goes to `/login?next=`; signed in, `/login` or `/signup` goes to `next` or `HOME_PATH` (`/home`).
  - Signup links to `/privacy` ("By signing up you agree to our Privacy Policy"); the landing footer and the download page link to both public pages.
- **Shell.** `components/app-shell.tsx` (sidebar or drawer, top bar with bell, bottom nav, Chat/Call dock) renders only after the customer and catalog queries load. Below it, screens call `useSession()`. The phone bottom nav follows the owner's home mockup: হোম · অর্ডার · অফার (running-offer count) · বাজার লিস্ট (`/bazar`, the mockup's cart) · প্রোফাইল; the services are on Home and in the sidebar, which starts with হোম.
- **Home (`/home`, `features/home.tsx`; owner's mockup).** Where a signed-in customer lands. The location row (`shortArea` of আমার লোকেশন from `geo.ts`; a tap opens the map sheet and saves through `useSaveMyLocation`, shared with Profile), the search "কী খুঁজছেন?" (suggests matching services and categories, and always offers to add the words to the bazar list), the fresh market banner, the bazar's categories as photo tiles (মাছ, মাংস, সবজি, চাল-ডাল, দৈনন্দিন পণ্য, আরও; `CATEGORY_PHOTOS` / `categoryPhoto` in `brand.ts`), আমাদের সেবা (the four services with their photos and live charges) and আজকের বিশেষ অফার (`OfferCard`s in a row, hidden when none runs). There is no product catalog or cart (owner's choice): a category or a search becomes a bazar list row through `useAddToBazar` in `lib/drafts.tsx`, which the bazar form takes (`useTakeBazarItems`) when it opens, so staff still price the list. CSS: the "Home" section of `globals.css` (`home-` classes, `.tone-coral`, `.tone-neutral`).
- **Locations and map.** `components/address-field.tsx` is the address box of signup and every order form: a read-only card (nothing is typed into it, and no chips below it) that opens the map sheet when tapped. Bazar, medicine, the shifting loading area and the parcel pickup start from the customer's location. An empty box opens the sheet at the device's position (`locate` defaults to `!initial`): a drag before the position arrives wins, and a rough position (over 100 m, typical of laptops) asks the customer to check the pin. `components/location-sheet.tsx` is the map sheet (a portal, full height in the phone column, a dialog on the web from 1024px): the address comes from the map, and the customer adds only an optional house/flat/road. Signup, the forms and Profile's আমার লোকেশন all use it. The Leaflet map (`components/map-picker.tsx`, OpenStreetMap tiles, a fixed centre pin) needs the browser, so it loads through `next/dynamic` with `ssr: false`. `navigator.geolocation` works only on HTTPS or localhost.
- **Prices and quotes.** Bazar and medicine forms have no price column: their bill shows the Catalog fees plus "we will send the price" (`QuoteNotice`, which says the charges may change with the distance) and the button sends the order. The shifting form shows each vehicle's rate as "… টাকা থেকে", and its bill is labour and floors plus "গাড়ী ভাড়া: দূরত্ব দেখে জানানো হবে". On the order page a QUOTED order shows a price card with the whole bill, Confirm (sending the `quoteVersion` and total it shows) and Cancel; a price that arrives while the page is open is flagged. While a price is coming, `components/push-prompt.tsx` offers phone notifications; the Notifications screen has the on/off switch. `features/offers.tsx` is আজকের অফার (also used by the landing page), linked from the sidebar with a count of running offers.
- **Photos and banners** (`components/banner.tsx`).
  - `Photo` is an `<img>` with the srcSet from `photo()`.
  - `ServiceBanner` (photo, name, blurb, charge) tops the shifting, medicine and parcel forms, passed as `ServiceCard`'s `banner`.
  - `PromoSlider` is the banner on the bazar form: running offers, then the four services. It uses scroll-snap, dots and arrows, and auto-advances except on hover, on focus, in a hidden tab or under reduced motion.
  - `useServiceBlurbs` and `useServiceCharges` are shared with the landing page, which also uses the photos in its switcher, services bento and closing band. The login/signup panels use the Old Dhaka photo.
- **Drafts.** Form input survives switching services because `lib/drafts.tsx`'s `useDraft` stores it in the signed-in layout, which stays mounted.
- **Deleting an account.** Profile's last section says what goes and what stays, asks for the mobile number to confirm, calls `DELETE /me` (after `forgetCustomerPush`) and returns to `/`.
- **Screens and data.**
  - Screens live in `features/*.tsx`; the pieces they share live in `components/ui.tsx`, `line-table.tsx` and `delivery-schedule.tsx`.
  - Data goes through TanStack Query (`lib/queries.ts`) and `lib/api.ts`. That client comes from `src/api-client`: fetch with credentials, plus one automatic refresh and retry on 401.
  - `lib/realtime.tsx` handles the socket, bell count and toast.
- **Language:**
  - `lib/i18n.tsx` provides `useLang()` with `t('বাংলা', 'English')`, `text()`, `taka()`, `digits()`, `rowNumber()` and `formatDate()`. Every visible string is written as `t(…)` where it's used.
  - The language is kept in the `pa_lang` cookie, and the root layout reads it on the server.
  - Amounts use Latin digits in both languages; row numbers use Bengali digits in Bangla mode.
- **Line tables.** A table starts with one row, and "add more" appears once the last row's required boxes are filled. Bazar requires item and quantity; medicine requires all four columns. Neither has a price column: staff price the lines. Fully empty rows are ignored.
- **Styling:**
  - Screens use the hand-written classes in `globals.css` (`.page-card`, `.field`, `.line-table`, `.bill` and so on), not Tailwind utilities.
  - The file is minified old v0 CSS, then "Screens from the paper sketches", then "Live data screens (API)", then "Landing page", then "Kingfisher theme", then "Photos and banners", then "Web version". Later rules win.
  - Colours are tokens on `:root` (the Kingfisher palette from the logo): `--blue` is the primary `#1265d8`, `--navy` (indigo, the logo's head) the headings, `--ink` the text, and `--green` success. The logo's other colours are `--teal`, `--sky`, `--sun`, `--orange` and `--coral`, plus `--brand-gradient` and `--warm-gradient`. Teal is too light for text on white, so text uses `--teal-ink`. Use tokens (or `color-mix` on them), never raw hex.
  - The "Kingfisher theme" section sets colours, type and shape for the whole site. Service tints come from `.svc-bazar` / `.svc-shifting` / `.svc-medicine` / `.svc-parcel` (or `.tone-*`), which set `--svc`, `--svc-soft` and `--svc-ink`.
  - Bangla needs `letter-spacing: 0` (via `html[lang='bn']`) to keep the headstroke (মাত্রা).
  - Everything before the "Web version" section is the phone design (a 430px column; it was also the old `/app` version's look at every width). The web shells start from it. Leave it alone.
  - Every web-only rule is scoped to `.mode-web`, the class on the web shells. Add new web styles there.
    - Phones (≤800px) get the phone design as it is.
    - Tablets (801–1023px) get a wider centred column.
    - The web (≥1024px) gets a fixed sidebar, a titled top bar, two-column screens and the split login.
  - Service forms pass their bill and Confirm as `ServiceCard`'s `summary`, which becomes a sticky column only on the web.
  - The fonts are Inter (Latin, `--font-latin`) and Hind Siliguri (Bangla, `--font-bangla`) via `next/font/google`, so builds need internet access. Stacks list Inter first, so Bangla falls through to Hind Siliguri.

### Admin panel (src/admin, src/app/(admin)/admin)

- **Stack.** Tailwind v4 utilities, with brand tokens in the `@theme` block of its `globals.css` (`brand-*` blue, `navy`, `ink`, `muted`, `line`, `canvas`, `chart`, the logo's `teal` (`-soft`, `-ink`), `sky`, `sun`, `accent` and `coral`, the `success`/`warning`/`violet`/`danger` tones with `-soft` and `-ink`, and `shadow-card`/`shadow-raised`). UI primitives are in `components/ui.tsx` (cva and tailwind-merge) and toasts use `sonner`.
- **Routes.** `/admin/login`, then `(panel)/…` for `/admin` (dashboard), orders, customers, catalog, offers (আজকের অফার), notifications, history, staff, roles, system and profile. Every link and redirect in the panel starts with `/admin`.
- **History.** `components/audit-feed.tsx` renders history entries everywhere. That means `/admin/history` (`history.view`, filters in the URL), the order page's History card, the customer page's History card and the dashboard's Recent activity.
- **Quotes.** On a bazar or medicine order, the Items card is the quote editor while PENDING or QUOTED (price every line, remove lines, add lines, change the shopping fee and delivery charge, a note for the customer, Send price). Once the customer confirms, it is read-only. On a shifting order the Vehicle rent card takes its place while PENDING or QUOTED: a link to Google Maps directions between the two pins (`directionsLink` in `geo.ts`), the rent box (starting at the vehicle's Catalog rate), a note and Send rent. Catalog calls the vehicle rate "Starting rate".
- **Lists, filters and stats.** Every list page keeps its filters, sort, page and page size in the URL through `useUrlFilters` (`lib/url-state.ts`; any change but the page goes back to page 1), so a view survives a refresh and can be shared. The pieces are in `components/filters.tsx` (`SearchBox`, `DateRangeFilter` with presets, `FilterTabs` with counts, `FilterChips`, `ClearFilters`) and `components/pagination.tsx` (`Pagination`: "Showing 26–50 of 312", page buttons from `pageWindow`, rows per page). Paged queries keep the previous page on screen while the next loads. Above each list, `StatGrid`/`StatTile` tiles show its `/stats`; a tile that is also a filter is a pressed button.
- **Permissions.** Controls show only when `can(admin, 'module.action')` (from `@/shared`) allows them, the same check the API enforces. The menu is built from each module's `view`; a page without it shows "not allowed" through `PermissionGate` (`components/permission-gate.tsx`), and `/admin` sends a role without the dashboard to `homePath(admin)`. `isSystemRole(admin)` is the Super admin. **`/admin/roles`** (`roles.view`) lists the roles with their staff counts and edits one at a time: names, descriptions and the matrix (a row per module with an "all" box, a box per action with its hint). New, Edit and Delete follow `roles.create`/`roles.edit`/`roles.delete`; the system role and the viewer's own role open read-only, and boxes for permissions the viewer doesn't hold are disabled. Staff pick roles from `GET /admin/roles`; only a Super admin sees Super admin in the pickers. Profile lists what the admin's role can do.
- **Realtime.** `lib/realtime.tsx` shows a toast and plays a WebAudio chime on `order:new` and when a customer confirms a price, gives order notifications an Open button, and refreshes the lists on any order change. The sound toggle is stored in localStorage. The bell-ring button beside it turns push notifications on for this device (`lib/push.tsx`).
- **Language.** The panel defaults to English, using the same `t()` convention; the cookie is `pa_admin_lang`.
- **Charts.** `components/charts.tsx` follows the data-viz rules: single series, one hue, ≤24px columns with 4px rounded ends, 2px gaps, hover/focus tooltips and a table view. `TrendChart` (orders or revenue per day or week), `StatusBreakdownChart` and `RevenueByServiceChart` link each bar to the filtered Orders list. `StatTile`'s `delta` shows the change against the previous period as ▲/▼ with the % (or percentage points for a rate), never colour alone.
- **Dashboard.** The period (`?from&to`, default the last 7 days) is in the URL. Right now (needs action, awaiting customer, active, today), then the period with its changes (orders, revenue, completed revenue, average bill, cancellation rate, new customers), the trend and status charts, revenue by service, top customers, staff activity (`dashboard.staff_activity`), recent orders and recent activity.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pashe Achi (পাশে আছি, "we're by your side") is a bilingual (Bangla/English) service app. It has four services: কাঁচা বাজার (fresh market), বাসা বদল (house shifting), জরুরী ঔষুধ (emergency medicine) and পণ্য আদান প্রদান (parcel delivery).

It is **one project that runs as one server on one port** (3000 by default):

| URL | What answers it |
|---|---|
| `/`, `/bazar`, `/orders`, … | Customer site (Next.js 16), phone-first |
| `/admin`, `/admin/orders`, … | Admin panel (the same Next.js app, styled with Tailwind) |
| `/api/v1/…` | NestJS 11 REST API (Prisma 7, PostgreSQL) |
| `/api/docs`, `/api/docs-json` | Swagger UI and the OpenAPI document |
| `/socket.io/` (namespace `/ws`) | Socket.IO realtime notifications |

- **Wording.** The customer site started as a v0.app prototype drawn from the owner's hand-drawn Bangla sketches. Labels in Bangla mode match the sketch wording exactly, including the English words the sketches use (Loading Area, Total Bill, Total cost, Chat, Call, point).
- **Mobile app.** A Flutter app comes later and will use the same API. So the API stays REST, versioned and documented, and it accepts `Authorization: Bearer` as well as cookies.

## One of everything (owner's explicit requirement)

The project has one `package.json`, one `node_modules`, one `.env`, one port, and a flat layout. Don't reintroduce `apps/` or `packages/`, workspaces, Turborepo, per-folder `package.json` or env files, or a second server or port.

- Add dependencies to the root `package.json` at **exact** versions. The package manager is npm; don't add a pnpm or Yarn lockfile.
- `.env` (gitignored) at the root holds every setting, and `.env.example` is the committed template. `src/server/config/env.ts` validates it at boot and lists every problem at once.

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

- **Single test file.** `npx vitest run src/shared/pricing.test.ts`, or `npx jest src/server/auth/cookies.spec.ts`.
- **Dev vs production.** `npm run dev` runs `nest start --watch -- --dev`. That `--dev` flag, not `NODE_ENV`, puts Next.js in dev mode. `src/server/load-env.ts` then sets `NODE_ENV` to development or production to match, unless the environment already sets it.
- **e2e database.** `test:e2e` uses `TEST_DATABASE_URL`, or `DATABASE_URL` with `_test` appended. It creates that database (UTF8), migrates it, and truncates it on every run. It runs Jest through `node --experimental-vm-modules`, because the Prisma 7 client loads its query engine with dynamic `import()`. The e2e tests boot the API alone, through `configureApp`, without the pages.
- **Seed.** `prisma/seed.ts` is idempotent: catalog defaults and the first super admin (from `SEED_ADMIN_*` in `.env`), each with a SYSTEM history row. `npm run db:seed:demo` adds `prisma/seed-demo.ts`: a deterministic month of data relative to today. It has a demo manager (01822222222), an operator (01833333333) and 8 customers, among them 01811111111 with the prototype's three orders. Every demo password is demo1234. Alongside about 65 orders in every status (bazar and medicine through the quote → confirm flow, some with a higher delivery charge for a far address; the demo customer's medicine order waits for their confirm), it writes timelines, history entries and notifications, two running offers, plus a map location for every customer (one pin per area; their orders carry pins too). It runs in one transaction and skips if the demo customer exists.
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
prisma/  schema, migrations, seed.ts        test/  API e2e tests        public/  icons
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
- `enums.ts`: services, statuses, `ORDER_TRANSITIONS` and `adminNextStatuses` (the moves staff may make), `QUOTED_SERVICES` / `isAwaitingPrice` (bazar and medicine are priced by staff), `CUSTOMER_CANCELLABLE`, `QUOTE_EDITABLE`, roles, `API_PREFIX` (`api/v1`), `SOCKET_NAMESPACE` and `SOCKET_EVENTS`.
- `labels.ts`: bilingual service and status labels.
- `brand.ts`: app name, logo paths, `PA-` order prefix and the banner photos.
  - The logo source is the transparent `public/logo/logo.png`, a kingfisher with no wordmark, so the name shows as text beside it. `logo-mark`/`logo-256`/`logo-512`, the icons and `public/og-image.jpg` (the share banner) are made from it, so re-render them if the logo changes.
  - `DEVELOPER` / `DEVELOPED_BY` are the developer credit ("Developed by Aethrasoft", linking to aethrasoft.com). `DeveloperCredit` (`src/customer/components/developer-credit.tsx`, `.dev-credit` CSS; `src/admin/components/developer-credit.tsx`) shows it in the landing footer, the sign-in and welcome screens and both sidebars.
  - `PHOTOS` and `photo(name)` give the `src`/`srcSet` of the photos in `public/images` (`{name}-800.webp` and `-1600.webp`, Unsplash License, sources listed in the file).
- `geo.ts`: `GeoPoint`, `DHAKA_CENTER`, `joinAddress` (details, then the map address, as one line) and `mapLink` (a Google Maps URL, no key, for staff and riders to open a pin). `schemas/locations.ts` has `customerLocationSchema` (the customer's one location, and the value of every address box) and `requiredPin` (the order pins `addressPin`, `loadingPin`/`unloadingPin`, `pickupPin`/`dropoffPin`, all required).
- `schemas/offers.ts`: আজকের অফার (`offerSchema`, `updateOfferSchema`); `OfferDto` / `AdminOfferDto` are in `types.ts`.
- `types.ts`: response DTOs.

### src/server (the API)

- **Modules:**
  - `auth` (customer and admin)
  - `users` (`/me`, `/me/location`, `/admin/customers`)
  - `admins` (`/admin/staff`)
  - `catalog` (pricing, vehicles, support line, delivery hours)
  - `uploads`
  - `orders`
  - `notifications`
  - `offers` (আজকের অফার: public `/offers`, `/admin/offers`)
  - `dashboard`
  - `audit` (the history log, `/admin/audit`)
  - `geo` (`/geo/reverse`: address text for a map pin, public)
  - `health`
- **Request DTOs.** All of them are in `common/dto.ts`, wrapping the shared schemas.
- **Errors.** Throw `AppException.badRequest('code')` and similar. `common/all-exceptions.filter.ts` shapes every error, including Prisma P2002/P2025.
- **Auth:**
  - Customers (`User`) and staff (`Admin`) are separate tables, with separate JWT secrets and separate cookies. Customers get `pa_at` / `pa_rt`; admins get `pa_admin_at` / `pa_admin_rt`. Both live on the one origin with path `/`.
  - Access tokens are 15-minute JWTs.
  - Refresh tokens are random strings stored as SHA-256 hashes. They rotate on every use. A replayed token, outside a 30-second grace window, revokes its whole family (`auth/token.service.ts`).
  - Customer sessions never expire. Their refresh tokens have a null `expiresAt`, and the `pa_rt` cookie lasts 400 days (the browser maximum) and is renewed on every refresh. They end only on logout, a password change, a block or a replay. Admin sessions end after `REFRESH_TOKEN_TTL_DAYS`.
  - `CustomerGuard` and `AdminGuard` re-read the account on every request, so blocking or deactivating someone takes effect immediately. Use `@Roles('MANAGER')` for manager-only routes; `SUPER_ADMIN` always passes.
  - Roles: OPERATOR handles orders. MANAGER also handles catalog, customer blocking and points, and broadcasts. SUPER_ADMIN also manages staff.
- **Orders:**
  - `orders.service.ts` writes the order, its children and its first timeline event in one transaction.
  - Status changes use `updateMany where status = from`, so concurrent changes can't both win. Every change writes an `OrderStatusEvent`.
  - **Customers never send prices.** Shifting and parcel are priced from the Catalog when placed. Bazar and medicine (`QUOTED_SERVICES`) are placed with no line prices (the bill is the fees only):
    1. Staff send a quote, `PUT /admin/orders/:id/quote`, with the whole list of lines: they price every line, can remove lines and can add new ones (a prescription's medicines). They may also change the order's `serviceFee` (bazar's shopping fee) and `deliveryFee` from the Catalog's, e.g. for a far address; a fee left out stays as it is, and medicine has no shopping fee (`quote.fees`). The order goes PENDING → **QUOTED**, `quoteVersion` goes up by one, and the customer is notified with the whole bill, the charges that changed (80 → 120) and the staff note.
    2. The customer confirms (`POST /orders/:id/confirm` with the `quoteVersion` and total they saw), which moves it QUOTED → BOOKED, or cancels.
    3. Staff may re-quote while QUOTED; after BOOKED the bill is locked (`order.bill_locked`).
    4. The quote locks the order row, and the confirm only applies while `quoteVersion` and the total are unchanged (`order.quote_changed`), so a customer never confirms a bill they have not seen, even a new one with the same total.
    5. Staff can't move a bazar or medicine order out of PENDING by status (`adminNextStatuses`).
  - After commit it emits domain events (`common/domain-events.ts`) through `@nestjs/event-emitter`: `orderCreated`, `orderStatusChanged`, and `orderQuoted` (with the bill before the quote and the note).
- **History log (`AuditLog`):**
  - Every change writes one row in the same transaction: `AuditService.record(entry, tx)`. Changes come from orders, bills, catalog, customers, staff, broadcasts, signups, profiles, and admin sign-ins and failed sign-ins.
  - Each row stores who did it, as snapshots: actor name and role, entity label, IP and user agent. It also stores only the changed fields (`diffChanges` in `audit/diff.ts`), plus a note and meta. No-op updates write nothing, and passwords are never stored.
  - Controllers pass the actor with `@Actor()` (or `clientInfo(request)` before sign-in). Add new actions to the Prisma enum, `AUDIT_ACTIONS`/`AUDIT_ACTIONS_BY_ENTITY` in `enums.ts`, and the labels in `labels.ts`.
  - `GET /admin/audit` is for managers and up. Any admin can read `GET /admin/orders/:id/history`.
  - The `audit_log` migration backfills history from `OrderStatusEvent`, users and admins.
- **Notifications:**
  - `notifications.listener.ts` turns those domain events into stored bilingual `Notification` rows, plus Socket.IO pushes.
  - The gateway is at namespace `/ws`. It authenticates in Socket.IO middleware, and rejected handshakes get `connect_error` "unauthorized". Sockets join the rooms `user:<id>`, `admin:<id>` and `admins`.
  - The wording is in `notification.content.ts` (plain functions, also used by the demo seed). Quote notifications carry the whole bill (`billBreakdown`) and the changed charges (`feeChanges`).
  - Delivery goes through the `NOTIFICATION_CHANNELS` list in `notifications.module.ts`: `RealtimeChannel` (Socket.IO) and `WebPushChannel`. Add FCM (the Flutter app) or SMS there.
  - **Phone and desktop push (Web Push):**
    - On only when `.env` has `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (generate the keys with `npx web-push generate-vapid-keys`); otherwise `GET …/push` answers `{ publicKey: null }` and the switches are hidden.
    - `PushSubscription` rows, at most one customer and one admin owner per browser endpoint (`@@unique([endpoint, audience])`), so a shared phone follows whoever signs in. Routes: `GET/PUT/DELETE /notifications/push` and `/admin/notifications/push`. Endpoints must be on a known push service (`isPushEndpoint` in `schemas/push.ts`), so the server never posts to an arbitrary address.
    - `web-push.channel.ts` sends in the background (8 at a time, finished before shutdown), in the language the browser subscribed with, opening the customer's own version (`basePath` `''` or `/app`) or `/admin`. A 404/410 from the push service deletes the row. `PUSH_SENDER` (`push.service.ts`) is the `web-push` call; the e2e tests replace it with a recorder.
    - The browser side: `public/sw.js` (scope `/`, no fetch handler; skips the system notification when a tab of that side is focused, since the toast shows it; a tap focuses or opens the URL), `src/api-client/push.ts` (`enablePush`, `syncPush` on every load and language change, `disablePush`, `forgetPush` before logout), and `PushProvider`/`usePush` in `src/customer/lib/push.tsx` and `src/admin/lib/push.tsx`. Each side remembers its own choice in localStorage (`pa_push`, `pa_admin_push`).
    - Browsers allow push only on HTTPS (localhost works without it). iPhones and iPads get it only after Add to Home Screen, which `src/app/manifest.ts` (start URL `/app`) and the customer layout's `appleWebApp` make possible.
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
  - Everywhere else it checks `pa_rt` and redirects to `/login`.
- **Calling the API.** Both front ends call the API on their own origin: the base is `/${API_PREFIX}`, and Socket.IO connects with `io(SOCKET_NAMESPACE)`. There is no API URL setting and no CORS.

### Customer site (src/customer, src/app/(customer))

- **Two versions, same screens.** The feature screens are shared. Only the shell, the links and the CSS differ.

  | Version | Entry and auth | Signed-in screens | Look |
  |---|---|---|---|
  | Web | `/` (landing, `features/landing.tsx`), `/login`, `/signup` | `(web)/…`: `/bazar`, `/shifting`, `/medicine`, `/parcel`, `/orders`, `/orders/[id]`, `/notifications`, `/offers`, `/profile` | Desktop layout from 1024px, phone layout below |
  | App | `app/(entry)/…`: `/app` (welcome screen), `/app/login`, `/app/signup` | `app/(main)/…`: `/app/bazar` … `/app/profile` | The original phone design at every width |

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
    - Below 1024px a sticky bar (Sign up, Chat, Call) replaces the Chat/Call dock.
    - Headlines use Anek Bangla (`displayFont` in `src/app/fonts.ts`). Only the landing root carries its variable, passed from `app/(customer)/page.tsx`.
    - Its CSS is the "Landing page" section, with `lp-` classes.
    - Signed-in visitors see "Open app" in place of Sign up / Login.
  - Each layout renders `<AppShell mode="web|app">`. `AuthScreen` and `AuthShell` take `version`.
  - Build every customer URL with `usePaths()` from `lib/paths.tsx` (inside a shell) or `webPaths` / `appPaths`, never a string literal. That way a link never leaves its version.
  - `src/proxy.ts` keeps each version separate:
    - Signed out: a screen goes to its version's login with `?next=`.
    - Signed in: a login, signup or `/app` welcome screen goes to `next` or that version's home (`HOME_PATH` `/bazar` or `APP_HOME_PATH` `/app/bazar`).
- **Shell.** `components/app-shell.tsx` (sidebar or drawer, top bar with bell, bottom nav, Chat/Call dock) renders only after the customer and catalog queries load. Below it, screens call `useSession()`.
- **Locations and map.** `components/address-field.tsx` is the address box of signup and every order form: a read-only card (nothing is typed into it, and no chips below it) that opens the map sheet when tapped. Bazar, medicine, the shifting loading area and the parcel pickup start from the customer's location. `components/location-sheet.tsx` is the map sheet (a portal, full height in the phone column, a dialog on the web from 1024px): the address comes from the map, and the customer adds only an optional house/flat/road. Signup, the forms and Profile's আমার লোকেশন all use it; `AuthShell` provides `ModeProvider` so it keeps each version's look. The Leaflet map (`components/map-picker.tsx`, OpenStreetMap tiles, a fixed centre pin) needs the browser, so it loads through `next/dynamic` with `ssr: false`. `navigator.geolocation` works only on HTTPS or localhost.
- **Prices and quotes.** Bazar and medicine forms have no price column: their bill shows the Catalog fees plus "we will send the price" (`QuoteNotice`, which says the charges may change with the distance) and the button sends the order. On the order page a QUOTED order shows a price card with the whole bill, Confirm (sending the `quoteVersion` and total it shows) and Cancel; a price that arrives while the page is open is flagged. While a price is coming, `components/push-prompt.tsx` offers phone notifications; the Notifications screen has the on/off switch. `features/offers.tsx` is আজকের অফার (also used by the landing page), linked from the sidebar with a count of running offers.
- **Photos and banners** (`components/banner.tsx`).
  - `Photo` is an `<img>` with the srcSet from `photo()`.
  - `ServiceBanner` (photo, name, blurb, charge) tops the shifting, medicine and parcel forms, passed as `ServiceCard`'s `banner`.
  - `PromoSlider` is the home screen's banner on the bazar form: running offers, then the four services. It uses scroll-snap, dots and arrows, and auto-advances except on hover, on focus, in a hidden tab or under reduced motion.
  - `useServiceBlurbs` and `useServiceCharges` are shared with the landing page, which also uses the photos in its switcher, services bento and closing band. The web login/signup panels and the `/app` welcome screen use the Old Dhaka photo.
- **Drafts.** Form input survives switching services because `lib/drafts.tsx`'s `useDraft` stores it in the version's layout, which stays mounted.
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
  - The "Kingfisher theme" section sets colours, type and shape for both versions. Service tints come from `.svc-bazar` / `.svc-shifting` / `.svc-medicine` / `.svc-parcel` (or `.tone-*`), which set `--svc`, `--svc-soft` and `--svc-ink`.
  - Bangla needs `letter-spacing: 0` (via `html[lang='bn']`) to keep the headstroke (মাত্রা).
  - Everything before the "Web version" section is the app version's look: a 430px phone column at every width. Leave it alone.
  - Every web-only rule is scoped to `.mode-web`, the class on the web shells. Add new web styles there.
    - Phones (≤800px) get the same layout as the app.
    - Tablets (801–1023px) get a wider centred column.
    - The web (≥1024px) gets a fixed sidebar, a titled top bar, two-column screens and the split login.
  - Service forms pass their bill and Confirm as `ServiceCard`'s `summary`, which becomes a sticky column only on the web.
  - The fonts are Inter (Latin, `--font-latin`) and Hind Siliguri (Bangla, `--font-bangla`) via `next/font/google`, so builds need internet access. Stacks list Inter first, so Bangla falls through to Hind Siliguri.

### Admin panel (src/admin, src/app/(admin)/admin)

- **Stack.** Tailwind v4 utilities, with brand tokens in the `@theme` block of its `globals.css` (`brand-*` blue, `navy`, `ink`, `muted`, `line`, `canvas`, `chart`, the logo's `teal` (`-soft`, `-ink`), `sky`, `sun`, `accent` and `coral`, the `success`/`warning`/`violet`/`danger` tones with `-soft` and `-ink`, and `shadow-card`/`shadow-raised`). UI primitives are in `components/ui.tsx` (cva and tailwind-merge) and toasts use `sonner`.
- **Routes.** `/admin/login`, then `(panel)/…` for `/admin` (dashboard), orders, customers, catalog, offers (আজকের অফার), notifications, history, staff and profile. Every link and redirect in the panel starts with `/admin`.
- **History.** `components/audit-feed.tsx` renders history entries everywhere. That means `/admin/history` (managers and up, filters in the URL), the order page's History card, the customer page's History card and the dashboard's Recent activity.
- **Quotes.** On a bazar or medicine order, the Items card is the quote editor while PENDING or QUOTED (price every line, remove lines, add lines, change the shopping fee and delivery charge, a note for the customer, Send price). Once the customer confirms, it is read-only.
- **Filters.** Order filters live in the URL query.
- **Permissions.** `lib/utils.ts` `canManage` / `isSuperAdmin` mirror the API's role checks to hide controls. The API still enforces them.
- **Realtime.** `lib/realtime.tsx` shows a toast and plays a WebAudio chime on `order:new` and when a customer confirms a price, gives order notifications an Open button, and refreshes the lists on any order change. The sound toggle is stored in localStorage. The bell-ring button beside it turns push notifications on for this device (`lib/push.tsx`).
- **Language.** The panel defaults to English, using the same `t()` convention; the cookie is `pa_admin_lang`.
- **Charts.** `components/charts.tsx` follows the data-viz rules: single series, one hue, ≤24px columns with 4px rounded ends, 2px gaps, hover/focus tooltips and a table view.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

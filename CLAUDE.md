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
- **Seed.** `prisma/seed.ts` is idempotent: catalog defaults and the first super admin (from `SEED_ADMIN_*` in `.env`), each with a SYSTEM history row. `npm run db:seed:demo` adds `prisma/seed-demo.ts`: a deterministic month of data relative to today. It has a demo manager (01822222222), an operator (01833333333) and 8 customers, among them 01811111111 with the prototype's three orders. Every demo password is demo1234. Alongside about 65 orders in every status, it writes timelines, history entries and notifications. It runs in one transaction and skips if the demo customer exists.
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
- `enums.ts`: services, statuses, `ORDER_TRANSITIONS` (the allowed status moves), roles, `API_PREFIX` (`api/v1`), `SOCKET_NAMESPACE` and `SOCKET_EVENTS`.
- `labels.ts`: bilingual service and status labels.
- `brand.ts`: app name, logo paths (resized from `public/logo/logo.jpeg`), `PA-` order prefix.
- `types.ts`: response DTOs.

### src/server (the API)

- **Modules:**
  - `auth` (customer and admin)
  - `users` (`/me`, `/admin/customers`)
  - `admins` (`/admin/staff`)
  - `catalog` (pricing, vehicles, support line)
  - `uploads`
  - `orders`
  - `notifications`
  - `dashboard`
  - `audit` (the history log, `/admin/audit`)
  - `health`
- **Request DTOs.** All of them are in `common/dto.ts`, wrapping the shared schemas.
- **Errors.** Throw `AppException.badRequest('code')` and similar. `common/all-exceptions.filter.ts` shapes every error, including Prisma P2002/P2025.
- **Auth:**
  - Customers (`User`) and staff (`Admin`) are separate tables, with separate JWT secrets and separate cookies. Customers get `pa_at` / `pa_rt`; admins get `pa_admin_at` / `pa_admin_rt`. Both live on the one origin with path `/`.
  - Access tokens are 15-minute JWTs.
  - Refresh tokens are random strings stored as SHA-256 hashes. They rotate on every use. A replayed token, outside a 30-second grace window, revokes its whole family (`auth/token.service.ts`).
  - `CustomerGuard` and `AdminGuard` re-read the account on every request, so blocking or deactivating someone takes effect immediately. Use `@Roles('MANAGER')` for manager-only routes; `SUPER_ADMIN` always passes.
  - Roles: OPERATOR handles orders. MANAGER also handles catalog, customer blocking and points, and broadcasts. SUPER_ADMIN also manages staff.
- **Orders:**
  - `orders.service.ts` writes the order, its children and its first timeline event in one transaction.
  - Status changes use `updateMany where status = from`, so concurrent changes can't both win. Every change writes an `OrderStatusEvent`.
  - After commit it emits domain events (`common/domain-events.ts`) through `@nestjs/event-emitter`.
- **History log (`AuditLog`):**
  - Every change writes one row in the same transaction: `AuditService.record(entry, tx)`. Changes come from orders, bills, catalog, customers, staff, broadcasts, signups, profiles, and admin sign-ins and failed sign-ins.
  - Each row stores who did it, as snapshots: actor name and role, entity label, IP and user agent. It also stores only the changed fields (`diffChanges` in `audit/diff.ts`), plus a note and meta. No-op updates write nothing, and passwords are never stored.
  - Controllers pass the actor with `@Actor()` (or `clientInfo(request)` before sign-in). Add new actions to the Prisma enum, `AUDIT_ACTIONS`/`AUDIT_ACTIONS_BY_ENTITY` in `enums.ts`, and the labels in `labels.ts`.
  - `GET /admin/audit` is for managers and up. Any admin can read `GET /admin/orders/:id/history`.
  - The `audit_log` migration backfills history from `OrderStatusEvent`, users and admins.
- **Notifications:**
  - `notifications.listener.ts` turns those domain events into stored bilingual `Notification` rows, plus Socket.IO pushes.
  - The gateway is at namespace `/ws`. It authenticates in Socket.IO middleware, and rejected handshakes get `connect_error` "unauthorized". Sockets join the rooms `user:<id>`, `admin:<id>` and `admins`.
  - Delivery goes through the `NOTIFICATION_CHANNELS` list in `channels.ts`. Add FCM push or SMS there.
- **Prisma 7:**
  - `prisma.config.ts` (root) holds the datasource URL and loads `.env`.
  - The `prisma-client` generator writes to `src/server/generated/prisma`, which is gitignored. It uses `moduleFormat = "cjs"` and `importFileExtension = "js"`.
  - The client uses `@prisma/adapter-pg`.
  - `migrate dev` does not regenerate the client, so run `db:generate`.
  - The first migration restarts the order-number sequence at 1001.
  - The database must be **UTF8**, or Bangla writes fail, and `PrismaService` refuses to start otherwise. On Windows, create it with `CREATE DATABASE … ENCODING 'UTF8' TEMPLATE template0`.
- **Uploads.** Prescriptions are checked by their magic bytes (`uploads/file-signature.ts`), not by MIME type. They are stored through the `StorageService` abstraction, currently `LocalDiskStorage` under `UPLOAD_DIR`. Customers can read only their own files; admins use `/admin/uploads/:id`.
- **Env.** In production, `config/env.ts` refuses the example secrets from `.env.example`.
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
  | Web | `/` (landing, `features/landing.tsx`), `/login`, `/signup` | `(web)/…`: `/bazar`, `/shifting`, `/medicine`, `/parcel`, `/orders`, `/orders/[id]`, `/notifications`, `/profile` | Desktop layout from 1024px, phone layout below |
  | App | `app/(entry)/…`: `/app` (welcome screen), `/app/login`, `/app/signup` | `app/(main)/…`: `/app/bazar` … `/app/profile` | The original phone design at every width |

  - The landing page shows live pricing from `GET /catalog`. Signed-in visitors see "Open app" in place of Sign up / Login.
  - Each layout renders `<AppShell mode="web|app">`. `AuthScreen` and `AuthShell` take `version`.
  - Build every customer URL with `usePaths()` from `lib/paths.tsx` (inside a shell) or `webPaths` / `appPaths`, never a string literal. That way a link never leaves its version.
  - `src/proxy.ts` keeps each version separate:
    - Signed out: a screen goes to its version's login with `?next=`.
    - Signed in: a login, signup or `/app` welcome screen goes to `next` or that version's home (`HOME_PATH` `/bazar` or `APP_HOME_PATH` `/app/bazar`).
- **Shell.** `components/app-shell.tsx` (sidebar or drawer, top bar with bell, bottom nav, Chat/Call dock) renders only after the customer and catalog queries load. Below it, screens call `useSession()`.
- **Drafts.** Form input survives switching services because `lib/drafts.tsx`'s `useDraft` stores it in the version's layout, which stays mounted.
- **Screens and data.**
  - Screens live in `features/*.tsx`; the pieces they share live in `components/ui.tsx`, `line-table.tsx` and `delivery-schedule.tsx`.
  - Data goes through TanStack Query (`lib/queries.ts`) and `lib/api.ts`. That client comes from `src/api-client`: fetch with credentials, plus one automatic refresh and retry on 401.
  - `lib/realtime.tsx` handles the socket, bell count and toast.
- **Language:**
  - `lib/i18n.tsx` provides `useLang()` with `t('বাংলা', 'English')`, `text()`, `taka()`, `digits()`, `rowNumber()` and `formatDate()`. Every visible string is written as `t(…)` where it's used.
  - The language is kept in the `pa_lang` cookie, and the root layout reads it on the server.
  - Amounts use Latin digits in both languages; row numbers use Bengali digits in Bangla mode.
- **Line tables.** A table starts with one row, and "add more" appears once the last row's required boxes are filled. Bazar requires item and quantity; medicine requires all five columns. Fully empty rows are ignored.
- **Styling:**
  - Screens use the hand-written classes in `globals.css` (`.page-card`, `.field`, `.line-table`, `.bill` and so on), not Tailwind utilities.
  - The file is minified old v0 CSS, then "Screens from the paper sketches", then "Live data screens (API)", then "Landing page", then "Web version". Later rules win.
  - Variable names are misleading: `--blue` is the teal primary `#287c68` and `--green` is amber.
  - Bangla needs `letter-spacing: 0` (via `html[lang='bn']`) to keep the headstroke (মাত্রা).
  - Everything before the "Web version" section is the app version's look: a 430px phone column at every width. Leave it alone.
  - Every web-only rule is scoped to `.mode-web`, the class on the web shells. Add new web styles there.
    - Phones (≤800px) get the same layout as the app.
    - Tablets (801–1023px) get a wider centred column.
    - The web (≥1024px) gets a fixed sidebar, a titled top bar, two-column screens and the split login.
  - Service forms pass their bill and Confirm as `ServiceCard`'s `summary`, which becomes a sticky column only on the web.
  - The font is Hind Siliguri via `next/font/google`, so builds need internet access.

### Admin panel (src/admin, src/app/(admin)/admin)

- **Stack.** Tailwind v4 utilities, with brand tokens in the `@theme` block of its `globals.css` (`brand-*`, `ink`, `muted`, `line`, `canvas`, `chart`). UI primitives are in `components/ui.tsx` (cva and tailwind-merge) and toasts use `sonner`.
- **Routes.** `/admin/login`, then `(panel)/…` for `/admin` (dashboard), orders, customers, catalog, notifications, history, staff and profile. Every link and redirect in the panel starts with `/admin`.
- **History.** `components/audit-feed.tsx` renders history entries everywhere. That means `/admin/history` (managers and up, filters in the URL), the order page's History card, the customer page's History card and the dashboard's Recent activity.
- **Filters.** Order filters live in the URL query.
- **Permissions.** `lib/utils.ts` `canManage` / `isSuperAdmin` mirror the API's role checks to hide controls. The API still enforces them.
- **Realtime.** `lib/realtime.tsx` shows a toast and plays a WebAudio chime on `order:new`, and refreshes the lists on any order change. The sound toggle is stored in localStorage.
- **Language.** The panel defaults to English, using the same `t()` convention; the cookie is `pa_admin_lang`.
- **Charts.** `components/charts.tsx` follows the data-viz rules: single series, one hue, ≤24px columns with 4px rounded ends, 2px gaps, hover/focus tooltips and a table view.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

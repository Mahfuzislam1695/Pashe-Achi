# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pashe Achi (পাশে আছি, "we're by your side"; formerly Jibon Khata) is a phone-first, bilingual (Bangla/English) service app with four services: কাঁচা বাজার (fresh market), বাসা বদল (house shifting), জরুরী ঔষুধ (emergency medicine) and পণ্য আদান প্রদান (parcel delivery). It also has order history and a profile. The screens follow the owner's hand-drawn Bangla sketches, so labels in Bangla mode match the sketch wording exactly, including the English words the sketches use (Loading Area, Total Bill, Total cost, Chat, Call, point). It started from v0.app (the v0 sandbox entries in `.gitignore` are left from that). It is a front-end prototype only. There is no backend, API, database, persistence or real authentication.

The app name lives in `lib/brand.ts`, along with the logo letter (পা), the order-ID prefix (`PA-`) and the welcome phrases that depend on the name. `app/layout.tsx` and `app/page.tsx` read it from there. The icons in `public/` (`icon-32x32.png`, `icon-192x192.png`, `apple-icon.png`) are static PNGs of the logo mark, so they must be re-rendered if the name changes. The project folder is still named `jibon-khata-app-development`.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (through `@tailwindcss/postcss`, no `tailwind.config`), shadcn in the `base-nova` style (built on `@base-ui/react`, not Radix), and lucide-react icons. The `@/*` path alias resolves to the repo root.

## Commands

The package manager is Yarn 1 (Classic), pinned to `yarn@1.22.22` through `packageManager` in `package.json`. Don't use npm or pnpm, which would create a second lockfile next to `yarn.lock`.

```bash
yarn install
yarn dev                 # next dev
yarn build               # next build
yarn start               # serve the production build
yarn tsc --noEmit        # type-check
yarn shadcn add <component>   # config lives in components.json
```

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `yarn build` passes even when there are type errors. Run `yarn tsc --noEmit` to catch them.
- There is no lint script, test framework or test suite.

## Architecture

**The whole app lives in `app/page.tsx`**, a single `'use client'` file. It contains the screens (`Auth`, `Bazar`, `Shifting`, `Medicine`, `Parcel`, `Orders`, `Profile`) and the shared pieces they use.

- **Business constants** are at the top of the file: every fee and rate, `VEHICLES`, and the placeholder support number `SUPPORT_PHONE` / `SUPPORT_WHATSAPP`. Change prices there, not inside the screens.
- **Services:** the `SERVICES` array (id, icon, `bn`, `en`) drives the bottom nav, the drawer, the welcome screen and Order history. To add a service:
  1. Add it to `ServiceId` and `SERVICES`.
  2. Write its component.
  3. Add a `hidden` wrapper for it in `Page`.
- **Language:**
  - `lang` state lives in `Page` and reaches components through `LangContext`.
  - Components call `useLang()` for `t(bn, en)`, `taka(n)`, `digits(n)` and `rowNumber(i)`. Every visible string is written as `t('বাংলা', 'English')` at its point of use. There is no separate dictionary.
  - Amounts use Latin digits in both languages ("760 টাকা" / "Tk 760"), as in the sketches. Row numbers use Bengali digits in Bangla mode.
- **`Page` state:** `lang`, `user` (`{ name, mobile, location, points }`; when it's `null`, `Auth` renders), `active: View`, `menuOpen` and `orders`.
- **Navigation** uses state, not routes, and there are no other routes under `app/`.
  - The four service screens are always mounted, and the inactive ones sit inside `<div hidden>`, so form input survives tab switches.
  - `Orders` and `Profile` mount only while active.
- **Shared pieces:**
  - `CustomerInfo`: the নাম / মোবা / লোকেশন / point header on every service
  - `LineTable`: numbered rows, used by the bazar and medicine tables. A table starts with one row, and "add more" appears only once every box in the last row is filled. On confirm, every started row must be complete (`isRowStarted` / `isRowComplete`); fully empty rows are ignored.
  - `BillSummary`: bill lines, a rule, then the total
  - `ContactDock`: Chat and Call, fixed at bottom centre on every screen, including auth
- **Orders:** each service's confirm button checks its required fields, then calls `onPlaceOrder`. That prepends to `orders` and switches to Order history.
- **Mocks:** auth (mobile + password, never checked) and reward points (always 0) are fake, and all state is in memory. File inputs only keep `file.name`.
- Vercel Analytics renders only when `NODE_ENV === 'production'`.

## Styling

- The screens use **hand-written semantic classes in `app/globals.css`** (`.page-card`, `.primary-button`, `.field`, `.line-table`, `.bill` and so on), not Tailwind utilities. Use the same classes when editing screens.
- The font is Hind Siliguri (Bengali + Latin). `app/layout.tsx` loads it with `next/font/google` as `--font-bangla`, so `yarn build` needs internet access.
- Theme colors are CSS variables on `:root`. Their names are left over from an older theme and are misleading: `--blue` is the teal primary (`#287c68`) and `--green` is amber. Many rules also hard-code hex colors.
- The layout is phone-first at every width. A `@media (min-width: 801px)` block limits `.app-shell` and `.auth-shell` to a centered 430px column. The drawer (`.sidebar.open` plus `.scrim`) slides over that column at every width.
- `globals.css` is minified old v0 CSS followed by a readable section, "Screens from the paper sketches", at the end. Order matters because later rules override earlier ones, and that section overrides several older rules. The older part still holds many unused classes.
- Bangla text needs `letter-spacing: 0`, because letter-spacing breaks the headstroke (মাত্রা). Rules keyed on `html[lang='bn']` handle this. `Page` keeps `<html lang>` in sync with the language toggle.
- The shadcn scaffolding (`components/ui/button.tsx`, and `cn` in `lib/utils.ts`) is unused by any screen. `globals.css` defines no shadcn theme tokens (`--primary`, `--ring`, `--border` and so on) and has no `@theme inline` block. Before relying on shadcn component styling, check that those tokens resolve.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

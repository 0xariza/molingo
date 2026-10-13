# Molingo

Live small-group English classes with Mona. Bilingual (Persian default, English), mobile-first.
See [PLAN.md](PLAN.md) for the full implementation plan and the decisions log.

## Local development

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env.local      # first time only
pnpm db:up                      # Postgres in Docker
pnpm db:migrate
pnpm db:seed                    # dev accounts (see scripts/seed-dev.ts)
pnpm dev                        # http://localhost:3000 → /fa
```

- `/fa/styleguide` and `/en/styleguide` show the design tokens, type and formatting (dev only).
- LiveKit for the live classroom (M6): `docker compose -f compose.dev.yml --profile live up -d`.

## Accounts (until the admin UI in M4)

Everyone logs in with **mobile number + password**. Accounts are activated with a one-time link:

```bash
pnpm user create --role admin --phone 0912xxxxxxx --name "Mona"     # prints an activation link
pnpm user create --role student --phone 0912xxxxxxx --name "Sara"
pnpm user link --phone 0912xxxxxxx --reset                         # new password-reset link
```

Activation links last 7 days and reset links 24 hours. Only the newest link works, and each works once.
For local testing, `pnpm db:seed` creates `09120000001` (admin) and `09120000002` (student); the dev
password is in `scripts/seed-dev.ts`.

## Checks and tests

```bash
pnpm check      # formatting, types, lint, i18n parity, RTL lint, unit + integration tests
pnpm test:e2e   # production build + Playwright (Pixel 7 Chrome and iPhone 15 WebKit)
pnpm build
```

Integration tests use `molingo_test` and e2e tests use `molingo_e2e`; both are recreated
automatically, so Postgres must be running. First time only: `pnpm exec playwright install chromium webkit`.
How tests are written (playwright-cli plan → generate → heal) is described in
[docs/ENGINEERING.md](docs/ENGINEERING.md).

## Conventions

The mandatory engineering standards are in [docs/ENGINEERING.md](docs/ENGINEERING.md). In short:

- **Text**: every UI string lives in `messages/fa.json` and `messages/en.json` (same keys).
- **Direction**: logical utilities only (`ms-*`, `pe-*`, `start-*`, `text-start`, `border-s`); `pnpm check:rtl` rejects `ml-*`, `left-*`, `text-right`, etc. Directional icons get `icon-directional`.
- **Dates and money**: use `src/lib/format.ts` (Jalali + Persian digits for `fa`, Tehran time, integer Toman).
- **No external requests at runtime**: fonts are self-hosted in `public/fonts`, no CDNs, no Google services.
- **Auth**: every admin/student page, Server Action and data function calls `requireAdmin()` / `requireStudent()` (`src/server/auth/current.ts`). The proxy's cookie check and the layout gates are only conveniences.
- **Database**: Drizzle schema in `src/db/schema`, migrations in `drizzle/` (`pnpm db:generate` after schema changes).

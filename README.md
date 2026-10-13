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
pnpm dev                        # http://localhost:3000 → /fa
```

- `/fa/styleguide` and `/en/styleguide` show the design tokens, type and formatting (dev only).
- LiveKit for the live classroom (M6): `docker compose -f compose.dev.yml --profile live up -d`.

## Checks

```bash
pnpm check   # typecheck, lint (incl. no hard-coded JSX text), i18n key parity, RTL lint, tests
```

## Conventions

- **Text**: every UI string lives in `messages/fa.json` and `messages/en.json` (same keys).
- **Direction**: logical utilities only (`ms-*`, `pe-*`, `start-*`, `text-start`, `border-s`); `pnpm check:rtl` rejects `ml-*`, `left-*`, `text-right`, etc. Directional icons get `icon-directional`.
- **Dates and money**: use `src/lib/format.ts` (Jalali + Persian digits for `fa`, Tehran time, integer Toman).
- **No external requests at runtime**: fonts are self-hosted in `public/fonts`, no CDNs, no Google services.
- **Database**: Drizzle schema in `src/db/schema`, migrations in `drizzle/` (`pnpm db:generate` after schema changes).

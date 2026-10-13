@AGENTS.md

# Molingo

- PLAN.md is the source of truth for scope and decisions; update its decisions log when something changes.
- Run `pnpm check` before calling work done. UI text goes in `messages/*.json`; use logical (RTL-safe) Tailwind utilities only.
- Next.js 16.4 with `cacheComponents`: read `node_modules/next/dist/docs/` before using unfamiliar APIs. The locale comes from `next/root-params` (`locale`).

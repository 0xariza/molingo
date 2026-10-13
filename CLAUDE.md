@AGENTS.md

# Molingo

- **Follow [docs/ENGINEERING.md](docs/ENGINEERING.md) for every change**: module boundaries, no speculative code, tests at every layer, and its Definition of Done.
- [PLAN.md](PLAN.md) is the source of truth for scope and business decisions; update its decisions log when something changes, and ask when a requirement is ambiguous.
- End-to-end tests use the `playwright-cli` skill workflow (plan in `specs/`, generate, heal). Run `pnpm check` after every task; run `pnpm test:e2e` (includes the build) and `pnpm audit:prod` once at the end of each phase, not after every step.
- Next.js 16.4 with `cacheComponents`: read `node_modules/next/dist/docs/` before using unfamiliar APIs. The locale comes from `next/root-params` (`locale`).

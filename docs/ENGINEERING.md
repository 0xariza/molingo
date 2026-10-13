# Molingo engineering standards

These standards are **mandatory for every milestone**, starting from M1. They are not a later
clean-up phase. Scope and business decisions live in [PLAN.md](../PLAN.md); this file says how we build.

## 1. Principles

- **Clean, modular architecture.** Every module has one clear responsibility. Business logic, data
  access, request handling (Server Actions / route handlers), UI, auth, billing, scheduling, etc.
  stay separate and loosely coupled.
- **Build only what is needed.** No speculative abstractions, factories, interfaces, config options,
  dependencies, tables or columns "for later". Add them in the milestone that first uses them.
- **No mess.** No duplicated business logic, dead code, unused files/keys/exports, abandoned
  experiments, permanent "temporary" workarounds, or comments that repeat the code.
- **Reuse before adding.** Check for an existing utility/module before creating one.
- **Explicit over clever.** Straightforward code, explicit behaviour, no hidden side effects.
  Targeted changes over rewrites; no broad refactors without a clear reason.
- **Business rules are centralized, typed and validated at the boundary** (Zod at Server Actions /
  route handlers, constraints in the DB), never only in the UI.
- **Errors are handled explicitly and consistently**: expected failures return typed error keys
  (translated in the UI); unexpected ones reach the localized error page and the server log.
- **If a requirement is ambiguous or conflicts with an earlier decision, stop and ask.** Don't invent
  behaviour.

## 2. Where code goes

| Path                     | Responsibility                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/…`     | Routes: pages, layouts, loading/error states. Thin: fetch via `src/server`, render components.                                                                                                                                                                                                                                         |
| `src/components/`        | UI components. `ui/` = generic building blocks (fields, buttons, skeletons). No data access.                                                                                                                                                                                                                                           |
| `src/server/<domain>/`   | Business logic and data access per domain (`auth/` today; `students/`, `classes/`, `scheduling/`, `billing/`, … as they arrive). `actions.ts` holds that domain's Server Actions: validate → authorize → call domain functions → redirect/return. Tests live in the module's `__tests__/` folder (`<module>.test.ts` per source file). |
| `src/db/schema/`         | Drizzle schema, one file per area. Migrations in `drizzle/` (generated, never hand-edited except custom SQL migrations).                                                                                                                                                                                                               |
| `src/lib/`               | Pure, framework-free utilities (formatting, phone parsing); tests in `src/lib/__tests__/`.                                                                                                                                                                                                                                             |
| `src/i18n/`, `messages/` | Locale routing and all UI text (`fa.json` / `en.json`, identical keys).                                                                                                                                                                                                                                                                |
| `src/test/`              | Shared test helpers (test DB lifecycle, factories) used by Vitest **and** Playwright.                                                                                                                                                                                                                                                  |
| `e2e/`                   | Playwright tests (one scenario per file), `fixtures.ts`, `seed.spec.ts`.                                                                                                                                                                                                                                                               |
| `specs/`                 | Playwright test plans (`<feature>.plan.md`) — the source for `e2e/`.                                                                                                                                                                                                                                                                   |
| `scripts/`               | Dev/ops scripts (CI checks, dev seed, account CLI, standalone start).                                                                                                                                                                                                                                                                  |

Rules that keep boundaries clean:

- Every protected page, Server Action and data function calls `requireAdmin()` / `requireStudent()`.
  Proxy cookie checks and layout gates are conveniences, not security.
- Files imported by `src/proxy.ts` must not import the DB client (see `src/server/auth/constants.ts`).
- Financial code (M10) must be deterministic, auditable and safe to retry: DB transactions, unique
  constraints against duplicate charges/invoices, effective-dated prices, historical records never
  rewritten.

## 3. Database and data integrity

- Schema changes go through migrations (`pnpm db:generate`, `pnpm db:migrate`); constraints and
  indexes are added where they protect an invariant or a real query.
- Operations that must succeed or fail together use a transaction.
- Don't store what can be derived reliably from an authoritative source; don't keep two pointers for
  one relationship.
- Billing must implement the rules exactly as decided in PLAN.md: per-session vs fixed-course pricing,
  absences billable, Mona's cancellations not billable, "Not Charged" excusals, optional replacement
  sessions, per-student overrides and effective-dated price changes, free level checks — each tested
  independently of the UI.

## 4. Testing

Testing is part of implementing a feature, not a later phase. Each layer covers what it is best at:

| Layer       | Tool                                                                                  | Covers                                                                                                         | Location                         |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Unit        | Vitest                                                                                | Pure rules, calculations, validation, utilities                                                                | `<module>/__tests__/`            |
| Integration | Vitest + real Postgres (`molingo_test`, recreated per run)                            | Domain modules with the DB: auth, billing, scheduling, constraints                                             | `src/server/<domain>/__tests__/` |
| End-to-end  | Playwright via the **playwright-cli** workflow, real production build + `molingo_e2e` | Complete user journeys and authorization boundaries in the real UI, on Pixel 7 (Chrome) and iPhone 15 (WebKit) | `e2e/`                           |

Don't use e2e tests for what a unit/integration test can cover.

### Playwright (playwright-cli workflow)

Tests are authored with the `playwright-cli` skill: **plan → generate → heal**.

1. **Plan**: write/extend `specs/<feature>.plan.md` (scenarios, user-level steps, `expect:` outcomes).
2. **Generate**: run the seed in debug mode and drive the real app with `playwright-cli`; the code it
   prints (role/label locators) becomes the test. One scenario per file at the path the plan names,
   with `// spec:` and `// seed:` headers and numbered step comments.
3. **Heal**: debug failures with `--debug=cli` + `playwright-cli attach`; fix the locator, the test,
   or the app; update the plan when user-visible behaviour changed. Never "fix" with sleeps,
   `networkidle` or skipped tests.

```bash
pnpm test:e2e                                     # build + run everything
PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test e2e/seed.spec.ts --debug=cli   # background
playwright-cli attach tw-XXXX                     # then explore / generate / diagnose
```

Conventions:

- Locators: `getByRole` / `getByLabel` first; text comes from `messages/*.json` (`messages` export in
  `e2e/fixtures.ts`), so copy changes don't break tests. Form errors: `formAlert(page)` (scoped to
  `<main>`; Next's route announcer is also `role="alert"`).
- Data: fixtures reset the e2e database before **every** test and create exactly the data a test
  needs (`seedAccounts`, `createUser`, `createAuthToken`). Tests run serially and never touch dev or
  production data (`recreateDatabase` refuses non-`_test`/`_e2e` names).
- Failure artifacts (trace, screenshot, video) are kept automatically under `test-results/`.
- The web server is never reused (`reuseExistingServer: false`): a stale server would test an old build.
- In shells with the RTK hook, run interactive Playwright commands through `rtk proxy …` (the hook
  rewrites the reporter, which breaks `--debug=cli`).

Workflows that get e2e coverage as they ship: login and access rules (done), student and class
management, scheduling and enrollment, class visibility and classroom access, room capacity, free level
checks, per-session and fixed-course pricing, absences and "Not Charged", cancellations and optional
replacements, discounts and effective-dated prices, monthly invoice generation/review/adjustment/issue,
duplicate-charge prevention, and Mona-vs-student permissions.

## 5. Checks — when to run what

Fast checks run on every task; the slow, whole-app checks run **once at the end of each phase**
(milestone), not after every step.

| When                       | Command           | What it runs                                                                                                             |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Every task / change        | `pnpm check`      | Prettier check, typecheck, ESLint (incl. no hard-coded JSX text), i18n key parity, RTL lint, Vitest (unit + integration) |
| End of phase               | `pnpm test:e2e`   | Production build + the full Playwright suite on both mobile browsers                                                     |
| End of phase               | `pnpm audit:prod` | Fails on high/critical vulnerabilities in production dependencies (needs internet)                                       |
| End of phase (in test:e2e) | `pnpm build`      | Production build                                                                                                         |

While developing a user-facing feature, a single Playwright scenario may be run or debugged on its own
(`pnpm exec playwright test <file>`) to author it; the full suite waits for the end of the phase.
CI (`.github/workflows/ci.yml`) runs everything on every push and pull request.

## 6. Workflow

During a phase, for each task:

1. Re-read the relevant part of PLAN.md and the existing code in the affected modules.
2. Pick the correct module and the smallest implementation that fully meets the requirement.
3. Reuse existing utilities; don't change unrelated modules.
4. Write unit/integration tests alongside the code; extend `specs/*.plan.md` and write the e2e
   scenarios for user-facing workflows.
5. Run `pnpm check`; fix what you broke.

At the end of the phase:

6. Run `pnpm test:e2e` (includes the production build) and `pnpm audit:prod`; fix failures.
7. Review for duplication, dead code, unnecessary complexity; update docs only where behaviour or
   architecture materially changed.

## 7. Definition of Done

A task is done when the first five items hold and `pnpm check` passes. A **phase** is done only when
**all** of these hold:

- [ ] It meets the stated requirements (PLAN.md decisions included).
- [ ] It follows the module structure above; no unrelated changes.
- [ ] No unnecessary code, dependencies, duplication, or dead code was introduced.
- [ ] Unit/integration tests added or updated.
- [ ] Playwright plan + tests added or updated for affected user workflows.
- [ ] `pnpm check` (every task) and, at the end of the phase, `pnpm test:e2e` (with the build) and
      `pnpm audit:prod` were **actually run** and pass.
- [ ] Data integrity, permissions and financial implications reviewed where relevant.
- [ ] The report states what was built, which checks ran, and any remaining limitations. Never claim a
      test passed unless it ran and passed; say explicitly when something couldn't be run.

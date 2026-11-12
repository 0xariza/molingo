# Hoopo: product and vision brief (for agents)

> Use this file for context only. **PLAN.md** decides scope and business rules. **docs/ENGINEERING.md** sets the bar for every change. If this brief and those files disagree, they win.
> Last synced with PLAN.md: 2026-11-12.

---

## 1. One-liner

**Hoopo (hoopo.ir / هوپو) is an Iran-hosted platform where independent language teachers run small live classes and manage their learners, schedules, progress and tuition in one place. Over time, an AI guide (also called Hoopo) will help learners practise between lessons.**

Tagline: «تدریس با شما، بقیه‌اش با هوپو.» / "You teach. Hoopo handles the rest."

## 2. Origin and naming

- It started as **Molingo**, a private tool for one English teacher, **Mona**, and her classes.
- It was renamed **Hoopo** on 2026-10-21 because an App Store app already uses "Molingo".
- **Legacy names stay in code on purpose.** Don't rename these: the session cookie `molingo_session`, the DB names `molingo_test`/`molingo_e2e`, the image names `molingo/*`, and the old token names (`ocean`, `brand`, `mist`…), which now hold Hoopo colour values.
- **Mascot:** Hoopo the hoopoe. In Attar's _Conference of the Birds_, the hoopoe guides the other birds. The crest shows emotion: closed means thinking, half-open is the default, fanned with a saffron glow means a correct answer or a level-up.
  - Open risk: the hoopoe is Israel's national bird. Test how the mascot lands with Iranian users before investing more in it.

## 3. Who it serves

| User                                          | What they need                                                                                                                                                           | Status                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Teacher** (Mona first, then her colleagues) | Run private (1 learner) and group (2–4 learners) live classes; manage learners, schedule, attendance, homework, levels and money without spreadsheets or messenger chaos | Core user today                    |
| **Learner** (زبان‌آموز)                       | Join class from a phone, see the schedule, do homework, see their level journey from A1 to C2                                                                            | Live (schedule, join); more coming |
| **Visitor / prospect**                        | Book a free 20-minute level check on a teacher's page and join it with a one-time link, no account needed                                                                | Live                               |
| **Platform owner**                            | Add and pause teachers, see early-access teacher leads. **Never sees teachers' learner data.**                                                                           | Live (M6c)                         |

## 4. Vision: four product stages

| Stage | Who                  | What changes                                                                                                                                                         |
| ----- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Mona's own classes   | **Live now**                                                                                                                                                         |
| **2** | Mona's colleagues    | Multi-teacher already built (M6c); the owner adds teachers by hand                                                                                                   |
| **3** | Any language teacher | Self sign-up and paid plans (Basic free, Pro, plus a line for schools)                                                                                               |
| **4** | Learners directly    | Hoopo becomes an AI companion and tutor. roadmap.sh-style premium: placement and the learning path stay **free**; **Hoopo Plus** (unlimited AI practice) is **paid** |

**Brand rule:** each teacher gets their own branded page (e.g. "Mona English" at `hoopo.ir/mona`). Hoopo appears only as a small "powered by hoopo". Hoopo is never the teacher's brand.

**Positioning:** the selling points are (a) a personal, goal-based learning roadmap and (b) AI built into the learning process, which is still labelled "coming soon". Class size isn't a selling point, and the copy never runs down other schools.

**The learning loop (target experience):** the teacher sets a topic → Hoopo warms learners up → the live class runs while Hoopo notes corrections → a report arrives before the next class. Only the live class exists today.

**Don't build early (Stage 3+):** teacher self sign-up, platform billing, a public pricing page, Hoopo Plus, and the AI guide. The whiteboard (Excalidraw over the LiveKit data channel) and the AI are planned for in the design but not built.

## 5. Hard constraints (non-negotiable)

1. **Works through international internet cuts.** No foreign runtime dependencies: no CDNs, no Google fonts or services, no reCAPTCHA, no external APIs at runtime. Fonts are self-hosted. DNS, backups and the image mirror are domestic.
2. **Persian-first and bilingual.** `fa` is the default (RTL, Jalali calendar, Persian digits, Asia/Tehran time, weeks run Saturday–Friday); `en` comes second. Every string lives in `messages/fa.json` and `messages/en.json` with identical keys. No literal JSX text. Use logical CSS utilities only (`ms-*`, `pe-*`, `start-*`, `text-start`). Dates and money go through `src/lib/format.ts`.
3. **Mobile-first.** Must work at 375 px on Android Chrome and iOS Safari. It ships as a PWA in M12, because Apple doesn't accept Iranian developer accounts.
4. **Small infrastructure.** A 2 GB Iranian VPS. Images are built off-box for linux/amd64 and shipped with `docker save | ssh docker load`. Nothing is built on the VPS.
5. **Hostile networks.** UDP is blocked or throttled on mobile carriers, so TURN/TLS and TURN/UDP run on 443 behind Caddy-l4 SNI routing. There's an ICE/TCP fallback and an audio-only mode.
6. **Security by scoping.** Every protected page, Server Action and data function calls `requireUser/requireTeacher/requireOwner/requireStudent`. Proxy and layout gates are conveniences, not security. Every query is scoped to the signed-in teacher, with tests proving that teacher A can't read or change teacher B's data. **Every table from M7 on has a `teacherId` from day one.**
7. **Honest copy.** Unbuilt features (AI guide, tuition reminders, receipts, pricing) are labelled "coming soon" or not shown at all.

## 6. Core domain rules

- **Accounts:** sign-in is mobile number + password, with Argon2id and hashed session tokens. There's no SMS provider, so the teacher sends a one-time activation or reset link over WhatsApp or Telegram. A link is shown once; only its hash is stored.
- **Learners:** one account per mobile number across the whole platform. A learner can study with several teachers. Per-teacher data (status, notes, start date) lives on a **teacher–learner link**, not on the learner. Only a learner's _sole_ teacher can change their number or send login links; otherwise one teacher could take over another teacher's learner.
- **Learner status:** `lead | active | paused | left`. `left` turns the login off.
- **Classes:** defined in full up front (level A1–C2, private or group, capacity, total sessions, length, weekly days and times, start date), and every session is generated at creation. There's no waitlist. Days and times can't change after creation; teachers use make-ups, moves and cancellations instead. "Continue with next course" creates the next class one level up.
- **Scheduling:** a Postgres exclusion constraint (`btree_gist`) makes double-booking a teacher impossible. Soft limits: **6 h/day** and **29 h/week** (the teacher can confirm past them). Level-check times count in clash checks.
- **Level check:** booked like Calendly from the teacher's open 20-minute times over the next 14 days. The visitor joins through a one-time `/l/<code>` link, with no login. It's free.
- **Live classroom:** LiveKit, up to 4 people. Tokens come from a Server Action (`joinRoomAction`), not an API route. The teacher can join from 60 min before until 30 min after the end; learners from 5 min before until the end. The teacher has moderation controls, and removals are recorded. Classmates see first names only. `/j/<classId>` share links grant nothing on their own.
- **Billing (M10, from PLAN.md):**
  - **Private:** priced per session. At the end of each Jalali month, the learner is invoiced for that month's held sessions. Absences are charged; "excused" absences and sessions the teacher cancelled are not.
  - **Group:** a fixed fee per learner for the whole course, charged upfront regardless of attendance.
  - All money is integer **Toman**. Level checks are free.
  - Make-ups are always added by hand.
  - Finance must be deterministic, auditable and safe to retry: transactions, unique constraints against duplicate invoices, effective-dated prices, and history that's never rewritten.

## 7. Where we are (2026-11-12)

**Done (M0–M6d):**

- Auth, the landing page, learners, classes and enrollment, the weekly Jalali schedule
- VPS and WebRTC test (M0)
- Live classroom (Room v2), level-check rooms, share links
- Hoopo rebrand (M6b)
- Multi-teacher with an owner role and `hoopo.ir/<slug>` teacher pages (M6c)
- Platform home page behind the `PLATFORM_HOME` flag (M6d); it stays off until its placeholders are filled with real content

**Still open on M6:** the manual network test matrix (Irancell, Rightel, switching Wi-Fi ↔ mobile mid-call, 3–4 real people in one room).

**Next, in order:**

| #   | Milestone                | Essence                                                                                                                                                                                              |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M7  | Attendance + session log | LiveKit webhooks feed time-in-room, with reconnects summed and idempotent retries. After a class: topics, a summary learners can see, private notes and per-learner notes                            |
| M8  | Homework                 | Assign to a class or session (snapshot of who's in it), attachments, text/file/voice submissions, review queue. Also enables file uploads, including the teacher photo                               |
| M9  | Levels & progress        | Seeded A1–C2 stages and milestones, quick tick list after a session, assessments with 1–10 skill ratings, explicit promotion, the learner's **My level** journey path with Hoopo on the current stop |
| M10 | Finance                  | Billing rules above, payments (partial allowed), income stats, overdue list                                                                                                                          |
| M11 | Dashboards               | Teacher and learner dashboards                                                                                                                                                                       |
| M12 | Hardening + PWA launch   | Backups and restore drill, TLS fallback, accessibility, low-end Android performance, PWA, RUNBOOK                                                                                                    |

**Why this order:** brand first, then ownership, then anything that stores new data, so that nothing gets migrated twice. M9's structured progress data is what the future AI guide will read.

## 8. Stack (short)

- Next.js **16.4** App Router + TypeScript, with `cacheComponents` and `output: standalone`. **The API differs from most training data:** read `node_modules/next/dist/docs/` before using an unfamiliar API. `proxy.ts` replaces middleware, and the locale comes from `next/root-params`.
- PostgreSQL 17 + Drizzle. Schema changes go through migrations (`pnpm db:generate`); never hand-edit a generated migration.
- Tailwind v4 (tokens in `@theme`), Radix primitives, Server Actions + Zod, next-intl (`/fa`, `/en`, always prefixed).
- LiveKit + livekit-client, Caddy with layer4, docker compose. Host cron calls `/api/cron/*`. Uploads go to local disk.
- **Module layout:**
  - `src/app/[locale]`: thin routes
  - `src/server/<domain>/`: logic and data. In `actions.ts`: validate → authorize → call domain → return.
  - `src/components`: UI only, no data access
  - `src/db/schema`: schema
  - `src/lib`: pure utilities

## 9. How to work on it

- Check PLAN.md's **decisions log** before proposing anything. If something is ambiguous or conflicts with an earlier decision, **ask; don't invent behaviour**. When a decision changes, update the log with the date.
- Build only what's needed: no "for later" tables, columns or config, no speculative abstractions, no dead code.
- Validate at the boundary with Zod and enforce rules in the DB with constraints and transactions. Expected failures return typed error keys that the UI translates.
- Every task needs Vitest unit/integration tests in the module's `__tests__/`. User workflows also need `specs/<feature>.plan.md` and Playwright e2e tests on **Pixel 7 Chrome and iPhone 15 WebKit**.
- Run `pnpm check` after every task. Run `pnpm test:e2e` and `pnpm audit:prod` **only when asked**; otherwise report them as "not run". Never claim a check passed unless it actually ran.
- Write UI copy in both languages. Persian is formal written Persian, addressing teachers with «شما».
- End each task with: what was built, which checks ran, and what limitations remain.

## 10. Known stale spots in PLAN.md (decisions log wins)

The detailed sections of PLAN.md predate some later decisions. Where they conflict, the dated **decisions log** at the top of PLAN.md is correct:

- **§2 Finance** mentions `per_session`/`course` class kinds, a `completed` session status, `class_prices` and `session_billing_exemptions`. The current model is class type `private|group`, session status `held`, and attendance `excused` meaning not charged. Confirm the M10 schema with the user before building it.
- **§5 Scheduling** describes nightly generation from recurring slots, with `is_override`/`original_date`. In reality, sessions are generated in full when the class is created, and moves use `moved_from`.
- **§3 Routes / §4 Auth** say `admin`, `requireAdmin` and `/admin/level-checks`. The current roles are owner, teacher and student, with per-teacher scoping, and level-check times live on `/admin/schedule`.
- **§7** still lists TURN UDP on 3478 in places. It moved to 443 on 2026-10-27.

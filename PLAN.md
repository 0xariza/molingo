# Molingo — Implementation Plan (v3, for approval)

> Status: **draft v3, awaiting approval**. No code written yet.
> Defaults I've assumed for open questions are marked **[assumed]**. See §10 for the questions.

## Decisions log (v2)
| Topic | Decision |
|---|---|
| Logo | Typographic wordmark **"mo" + "lingo"**, built as a React/SVG component (`<Logo variant="light\|dark" />`). On light backgrounds: "mo" in Brand blue `#13609B`, "lingo" in Ocean `#071E36`. On dark backgrounds: "mo" in Whale light `#8EC5E8`, "lingo" in white. Barlow Condensed 700, wide tracking, lowercase. The Latin wordmark is used in both locales. Whale light is too pale to read as text on the light background, which is why light backgrounds use Brand blue. The whale-tail marker for the level path is a small custom SVG icon. |
| VPS | **Develop locally first.** Rent a cheap Iranian VPS **month-to-month** only for the WebRTC test (M0, moved to just before the live classroom), and keep it as production if it performs well (§7). |
| Billing | Two pricing models, chosen **per class** when Mona creates it. **Per-session**: the class has a session price, and at the **end of each Jalali month** each student is invoiced for that month's held sessions, **absences included**, with sessions **Mona cancelled excluded automatically**. **Fixed course**: a set number of sessions for a fixed fee per student (e.g. 10 sessions = 5,000,000 Toman), whatever the attendance. Everything is stored and shown in **Toman**. Level checks are **free**. Mona can mark a student's session **"Not Charged"** with one click (absence with notice). Course fees are charged **upfront at enrollment**. Cancelling a course session offers an **optional** replacement at the end. Capacity: **max 3**, or **max 4 for fixed-price group courses**. |
| Level check | In-app. Lead → student (status `lead`) with phone → `level_check` session (1:1) → the student joins from their dashboard. |
| Class access | Students join from **Join Class** on their dashboard or schedule. Mona can also copy a **share link** (`molingo.ir/j/<code>`) for WhatsApp or Telegram. It still requires login and the same join rules, so it never bypasses them. |
| Login | **Mobile number + password** for everyone (Mona included). Email is optional profile data. Accounts are activated with a one-time "set your password" link that Mona sends (there's no SMS provider in the MVP). |

---

## 0. Stack decisions (TL;DR)

| Area | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 App Router + TypeScript**, `output: "standalone"` | As requested. Standalone output is a small Node server, which suits a 2 GB box. |
| DB / ORM | **PostgreSQL 17 + Drizzle** | Keep Drizzle: SQL-first, no engine binary, and raw SQL migrations for the `btree_gist` exclusion constraint that prevents double-booking. Prisma adds a heavier engine and gets in the way of that constraint. |
| Auth | **Own session auth (Lucia-style pattern)**: Argon2id (`@node-rs/argon2`), random session token stored as a SHA-256 hash in Postgres, httpOnly cookie | We only need email + password, invites and resets. That's about 200 lines with no external callbacks. Auth.js credentials mode fights DB sessions; Better Auth works but brings more than we need. |
| i18n | **next-intl**, routes `/fa/...` and `/en/...` (always prefixed) | Works with App Router and server components, typed messages, ICU plurals. See §6. |
| Dates | `Intl.DateTimeFormat` (`fa-IR-u-ca-persian-nu-arab`) for display, **date-fns-jalali** for Jalali math (month boundaries), `@date-fns/tz` for Asia/Tehran | Node's built-in full ICU already handles the Persian calendar and Persian digits. |
| Styling | **Tailwind v4**, tokens in `@theme`, logical utilities only (`ms-*`, `pe-*`, `start-*`) | RTL comes almost for free. |
| UI primitives | Radix UI primitives (dialog, sheet, dropdown), custom-styled | Accessible, RTL-aware, no CDN. |
| Forms / validation | Server Actions + **Zod**, shared schemas | One validation path. |
| Live | **LiveKit server (Go binary)** + `livekit-client` + `@livekit/components-react`, `livekit-server-sdk` for tokens, room service and webhooks | As requested. |
| Files | **Local disk volume** (`/data/uploads`), served through an authorized route handler | MinIO would cost about 300 MB of RAM for no benefit at this scale. The storage interface stays swappable. |
| Proxy / TLS | **Caddy with the `layer4` plugin** (custom build) | We need SNI routing so HTTPS and TURN/TLS can share port 443 (§7). |
| Jobs | Host `cron` calling `curl` on internal `/api/cron/*` routes with a shared secret | No Redis and no queue. |
| Deploy | docker compose. Images **built off-box** (linux/amd64), shipped with `docker save \| ssh docker load` | Docker Hub and npm are unreliable from Iran, and building Next.js on 2 GB of RAM is painful. |

---

## 1. Architecture

```
                       Phone / desktop browser (fa | en)
                 HTTPS 443            WSS 443           WebRTC media
                    │                    │           UDP 50000-50200 ─┐
                    │                    │           TCP 7881 (ICE)  ─┤
                    │                    │           TURN/TLS 443 ───┤
┌───────────────────▼────────────────────▼────────── Iranian VPS ────┼──────┐
│  Caddy (+layer4) :80 :443                                          │      │
│   ├─ SNI molingo.ir      → app :3000        (HTTP reverse proxy)   │      │
│   ├─ SNI lk.molingo.ir   → livekit :7880    (signaling WS)         │      │
│   └─ SNI turn.molingo.ir → livekit TURN :5349 (raw TLS passthrough)│      │
│                                                                    ▼      │
│  ┌──────────────── Next.js app :3000 ─────────────┐   ┌── LiveKit server ─┐│
│  │ RSC pages · Server Actions · Route handlers    │   │ SFU + embedded    ││
│  │  /api/livekit/token  ──(createRoom, JWT)──────▶│──▶│ TURN, simulcast,  ││
│  │  /api/livekit/webhook ◀─(signed webhook)───────│◀──│ dynacast          ││
│  │  /api/files/[id] (authz stream)                │   └───────────────────┘│
│  │  /api/cron/* (session generation, reminders)   │                        │
│  └──────┬──────────────────────────┬──────────────┘                        │
│         ▼                          ▼                                       │
│   PostgreSQL :5432 (local)   /data/uploads (volume)    host cron: backups  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Join flow (token + webhook)**
1. Student taps **Join** → `POST /api/livekit/token { sessionId }`.
2. The server checks: logged in, allowed in this session (§4), session `scheduled`, now inside the join window, not removed from this session.
3. The server calls `RoomService.createRoom("s_<sessionId>", { maxParticipants: capacity + 2, emptyTimeout: 600 })` (idempotent), then signs an AccessToken:
   identity = `user.id`, name = display name, `attributes.role` = `teacher|student`, TTL = until `endsAt + 30 min`.
   Grants: `roomJoin`, `room`, `canSubscribe`, `canPublishData`, `canPublish` with sources `[camera, microphone]` for students and `+screen_share` for the teacher, `canUpdateOwnMetadata` (used for raise hand). The teacher also gets `roomAdmin`.
4. The client connects to `wss://lk.molingo.ir` with `adaptiveStream`, `dynacast` and simulcast layers.
5. LiveKit → `POST http://127.0.0.1:3000/api/livekit/webhook` (loopback only), verified with `WebhookReceiver`.
   `participant_joined` / `participant_left` / `room_finished` → `attendance_events` → `attendance` gets aggregated.
6. Teacher moderation (mute, remove) goes through Server Actions → `RoomService.mutePublishedTrack` / `removeParticipant`. Removing someone also writes a `session_removals` row, so a new token gets refused.

---

## 2. Data model (Drizzle / Postgres)

Conventions: `uuid` PKs (v7), `created_at` / `updated_at timestamptz`, all instants stored as **UTC `timestamptz`**, money as **`bigint` minor units**. Enums are Postgres enums.

### Identity
- **users**: id, **phone (E.164 `+98…`, unique, login identifier)**, email (citext, nullable), password_hash (nullable until activated), role `admin|teacher|student`, display_name, locale `fa|en`, is_active, last_login_at. Phone input accepts `0912…`, `912…`, `+98…` and Persian/Arabic digits, normalized with `libphonenumber-js`.
- **auth_sessions**: id (sha256 of token), user_id → users, expires_at, created_at, user_agent, ip. Index (user_id)
- **auth_tokens**: id (hash), user_id, kind `activation|reset`, expires_at, used_at. Single use, 7-day activation links, 24-hour resets
- **teachers**: id, user_id (unique), bio, weekly_hour_limit (29), daily_hour_limit (6). *Multi-teacher-ready; MVP seeds only Mona.*
- **students**: id, user_id (nullable until invited), full_name, phone, email, telegram/whatsapp handle, status `lead|active|paused|left`, preferred_locale, current_stage_id → level_stages (nullable), notes (private), lead_id (nullable), started_at. Index (status)

### Funnel
- **leads**: id, name, phone, email, preferred_times (text), self_assessed_level, message, locale, source, status `new|contacted|scheduled|converted|lost`, converted_student_id. Index (status, created_at)
- **waitlist_emails**: id, email (citext, **unique**), locale, source, created_at

### Classes & scheduling
- **classes**: id, teacher_id, name, level (CEFR enum A1–C2), stage_id (optional target sub-stage), **format `ongoing|course`**, capacity smallint, default 3, **CHECK capacity BETWEEN 1 AND 3, OR (pricing_model = 'fixed_course' AND capacity ≤ 4)**. Only fixed-price group courses can have 4 students, status `open|full|archived`, is_public (show on landing), description, timezone default `Asia/Tehran`
  - **Pricing** (set at creation, editable): `pricing_model per_session|fixed_course`. Per-session: `session_price_toman`. Fixed course: `course_price_toman` + `course_session_count` (e.g. 10), plus `starts_on`.
  - Price changes are kept in **class_prices** (class_id, effective_from, session_price_toman | course_price_toman), so a change only affects sessions from that date and old invoices never change.
  - A `course` class generates **exactly `course_session_count` sessions** from its slots instead of a rolling 10-week window. When Mona cancels a course session, the cancel dialog offers an optional **"Add replacement session at the end"** choice. Nothing is added automatically. Replacements are marked `kind = makeup`.
- **class_slots**: id, class_id, weekday smallint (0 = Saturday … 6 = Friday), start_time `time`, end_time `time` **CHECK end > start**, valid_from date, valid_until date nullable. *Wall-clock times in the class timezone.*
- **sessions**: id, teacher_id, class_id (nullable), slot_id (nullable), kind `class|level_check|makeup|private`, original_date date (nullable), starts_at, ends_at **CHECK ends_at > starts_at**, status `scheduled|live|completed|cancelled`, is_override bool, cancel_reason, livekit_room
  - **UNIQUE (slot_id, original_date)**: makes generation idempotent
  - **EXCLUDE USING gist (teacher_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status <> 'cancelled')**: a hard guarantee against double-booking (needs `btree_gist`)
  - Index (class_id, starts_at), (starts_at)
- **session_participants**: session_id, student_id, PK both. *For non-class sessions (level check, private, makeup).*
- **session_billing_exemptions**: session_id, student_id, reason, created_by, created_at. PK (session_id, student_id). This is the one-click **"Not Charged"** for a student who gave advance notice of an absence.
- **share_links**: code (short random, unique), target `class|session`, target_id, created_by, revoked_at. `/j/<code>` resolves a class link to that class's current or next session.
- **session_removals**: session_id, user_id, removed_at

### Enrollment
- **enrollments**: id, class_id, student_id, status `active|waitlisted|paused|ended`, waitlist_position (nullable), price_override_toman (nullable, for an individual discount), started_on, ended_on
  - **Partial UNIQUE (class_id, student_id) WHERE status IN ('active','waitlisted')**
  - Capacity rule: the transaction locks the class row (`SELECT … FOR UPDATE`) and counts active enrollments. If the class is full, the new row becomes `waitlisted` and the class status changes to `full`. When a seat opens, the admin promotes the first waitlisted student; we don't auto-promote.

### Live & logs
- **attendance_events**: id, session_id, user_id, event `joined|left`, at, livekit_event_id (**unique**, for webhook dedupe)
- **attendance**: session_id, user_id, first_joined_at, last_left_at, total_seconds, status `present|late|absent|excused`. PK (session_id, user_id). Rebuilt from events, so reconnects add up correctly.
- **session_logs**: session_id (PK), summary (shown to students), private_note (admin only), logged_at
- **session_topics**: id, session_id, text, position, milestone_id (nullable, links a topic to a can-do goal)
- **session_student_notes**: session_id, student_id, note, visible_to_student bool. *Useful structured data for Phase 3.*

### Homework & files
- **files**: id, owner_user_id, storage_key, original_name, mime, size_bytes, sha256. Allowed types: pdf, docx, jpg, png, webp, m4a, mp3, webm (audio). Max 15 MB.
- **assignments**: id, teacher_id, class_id (nullable), session_id (nullable), title, body, due_at. **CHECK class_id or session_id not null**
- **assignment_recipients**: assignment_id, student_id. *Snapshot of the roster when the assignment is created, so students who join later don't inherit old homework.*
- **assignment_files** / **submission_files**: join tables → files
- **submissions**: id, assignment_id, student_id, body, status `submitted|needs_revision|reviewed`, feedback, score (nullable), submitted_at, reviewed_at. UNIQUE (assignment_id, student_id), revisions overwrite with a `revision` counter. Index (status) for the review queue.

### Levels & progress (structured for Phase 3)
- **levels**: id, code `A1…C2` (unique), position, name, can_do_summary ("what you'll be able to do")
- **level_stages**: id, level_id, code (`B1.2`, unique), position, title, description. Editable, reorderable.
- **milestones**: id, stage_id, text, skill (nullable enum), position, is_active. *We never hard-delete a milestone; we deactivate it so history survives.*
- **student_milestones**: student_id, milestone_id, completed_at, completed_by, session_id (nullable, the session where it was achieved), note. PK (student_id, milestone_id). Stage progress % = done ÷ active milestones in the stage.
- **assessments**: id, student_id, assessor_id → teachers, kind `placement|periodic|level_up`, assessed_at, stage_id (level at assessment), promoted_to_stage_id (nullable), overall_note. Index (student_id, assessed_at desc)
- **skill_ratings**: assessment_id, skill `speaking|listening|vocabulary|grammar|reading|writing`, score smallint **CHECK 1–10** [assumed]. PK (assessment_id, skill)
- Level-up = an assessment of kind `level_up`, created only through an explicit **Confirm promotion** action, which updates `students.current_stage_id` in the same transaction.

### Finance & settings
All money is **integer Toman** (`bigint`).
- **invoices**: id, student_id, period (Jalali month, e.g. `1405-08`, nullable for course invoices), period_start/period_end, status `draft|issued|paid|partial|void`, issued_at, due_on, total_toman. Partial UNIQUE (student_id, period) WHERE status <> 'void'
- **invoice_lines**: id, invoice_id, enrollment_id, kind `sessions|course_fee|adjustment`, quantity, unit_price_toman, amount_toman, description, plus **invoice_line_sessions** (line_id, session_id), so every charged session is listed and can't be billed twice (UNIQUE session_id + enrollment)
- **Per-session billing (automatic)**: on day 1 of each Jalali month, a cron drafts invoices for the month that just ended. For each active or paused-mid-month enrollment in a `per_session` class, it charges every session that:
  - belongs to that class and falls inside the month **and** inside the enrollment's dates (so mid-month joiners aren't charged for earlier sessions),
  - has status `completed` or `scheduled` with its end time in the past (it was held),
  - **is not `cancelled`**. Teacher cancellations drop out with no manual step.
  - **has no `session_billing_exemptions` row for that student** ("Not Charged").
  Attendance **doesn't matter**: absent students are still charged. The price is the one effective on the session date (`class_prices`), or the enrollment override if set. Level checks are never billed.
  Mona reviews the drafts (adjustment lines for any other exception), then issues them. If "Not Charged" is toggled after the invoice was issued, the system offers to add a matching credit line.
- **Fixed-course billing**: when a student is enrolled in a `course` class, one `course_fee` line (`course_price_toman`, or the override) is drafted for the start of the course. Attendance and replacement sessions don't change it. The fee is **charged upfront at enrollment**. Joining late or leaving early is handled by Mona with manual adjustment lines.
- **Rescheduled sessions** are billed in the month they actually took place.
- **payments**: id, student_id, invoice_id (nullable), amount_toman, paid_on, method `card_to_card|cash|bank_transfer|other`, reference, note. Invoice status is derived from the sum of its payments. Index (student_id), (paid_on)
- **Overdue** = an issued invoice not fully paid by `due_on + grace days`.
- **settings** (key/value jsonb): join window minutes, assessment interval (default 8 weeks), payment grace days, week start, session generation horizon.
- **audit_log**: actor, action, entity, entity_id, diff jsonb, at. *Covers promotions, payments, deletions.*

---

## 3. Route map

All pages live under `app/[locale]/…`, with `locale ∈ {fa, en}`, so `/fa/admin/students` and `/en/admin/students` are the same page.

**Public**
| Route | Page |
|---|---|
| `/` | Redirects to the `NEXT_LOCALE` cookie's locale or `/fa` |
| `/[l]` | Landing: hero, method, open classes (live), about, pricing, AI waitlist, FAQ |
| `/[l]/level-check` | Level-check booking form (also a section on the landing) → `leads` |
| `/[l]/login`, `/[l]/activate/[token]`, `/[l]/reset/[token]` | Auth (mobile + password) |
| `/j/[code]` | Share link → login if needed → redirects to the user's locale and the classroom pre-join page (join rules still apply) |
| `/[l]/privacy` | Privacy page (we store contact data) |

**Student** (`/[l]/app/*`). Bottom nav: Home · Schedule · Homework · Level · Me
| Route | Page |
|---|---|
| `/app` | Dashboard: next session plus Join, homework due, recent topics, level card |
| `/app/schedule` | Upcoming and past sessions (list on mobile, week view on desktop) |
| `/app/sessions/[id]` | Session detail: time, topics, summary, my note, homework |
| `/app/classroom/[id]` | Live room: pre-join device check, then the room |
| `/app/homework`, `/app/homework/[id]` | List (due / submitted / reviewed), detail + submit (text, file, voice recording) |
| `/app/level` | My level: whale-tail roadmap, current stage, milestones, skills, latest note, history |
| `/app/me` | Profile, language, password |

**Admin** (`/[l]/admin/*`). Sidebar on desktop, bottom nav + "More" sheet on mobile
| Route | Page |
|---|---|
| `/admin` | Dashboard (§3.12 widgets) |
| `/admin/leads` | Leads pipeline → convert to student |
| `/admin/students`, `/new`, `/[id]` | Student list (filters: status, level, overdue). Detail tabs: Profile · Classes · Level & milestones · Assessments · Homework · Attendance · Payments |
| `/admin/classes`, `/new`, `/[id]` | Class detail: slots, roster, waitlist, sessions |
| `/admin/schedule` | Week calendar with hour meters (day / week vs limits), add a one-off session |
| `/admin/sessions/[id]` | Before/after a session: log topics, summary, per-student notes, attendance with a **"Not Charged" toggle per student**, **quick milestone tick list per student**, assign homework |
| `/admin/classroom/[id]` | Live room (teacher controls) |
| `/admin/homework` | Review queue |
| `/admin/levels` | Edit levels, stages, milestones (drag to reorder) |
| `/admin/finance`, `/invoices/[id]`, `/payments/new` | Generate and review monthly invoices, record payments, monthly / class / student income, overdue list |
| `/admin/waitlist` | AI waitlist emails, CSV export |
| `/admin/settings` | Limits, windows, intervals |

**Route handlers**: `/api/livekit/token`, `/api/livekit/webhook`, `/api/files/[id]`, `/api/cron/generate-sessions`, `/api/cron/close-rooms`, `/api/health`.

---

## 4. Auth & authorization

- **Login**: **mobile number + password**. Argon2id. Passwords need at least 8 characters, checked against a list of common passwords. Rate limit is 5 attempts per 15 min per IP + phone, plus a global cap, because phone numbers are easy to guess (a Postgres table, no Redis). Session cookie `molingo_session`: httpOnly, Secure, SameSite=Lax, 30-day sliding expiry.
- **Account activation**: Mona creates the student (or converts a lead) and clicks **Copy activation link**. She sends it on WhatsApp or Telegram, and the student opens it and sets their own password. Forgotten passwords work the same way: Mona generates a reset link. *Later we can plug in a domestic SMS provider for OTP resets without schema changes.*
- **Class access**: students simply log in and tap **Join Class**. Share links (`/j/<code>`) are just shortcuts. The admin can revoke them.
- **Enforcement**: `proxy.ts` (Next 16's middleware) handles the locale and a cheap cookie presence check. **Real checks live in the data layer**: every server action and query calls `requireAdmin()` or `requireStudent()` and scopes by `student_id`. Never trust the route alone.
- **Matrix**
  | Resource | Admin | Student |
  |---|---|---|
  | Students, leads, finance, settings, levels editor | full | — (own profile only) |
  | Classes / sessions | full | read own (enrolled or participant) |
  | Session log | full | `summary` + topics + own visible notes. Never `private_note` |
  | Assignments / submissions | full | own recipients only. Create/edit own submission until reviewed |
  | Files | all | own uploads + attachments of assignments they received |
  | Level data | full | read own. Never other students' data |
  | Classmates | — | first names only, in the room and roster [assumed] |
- **Room-join rule**: student is allowed if (active enrollment in `session.class_id` covering the session date **OR** row in `session_participants`) **AND** status = `scheduled|live` **AND** `starts_at − 15 min ≤ now ≤ ends_at` **AND** not in `session_removals`. The admin can join anytime from `−60 min`.

---

## 5. Scheduling logic

- **Source of truth**: `class_slots` hold wall-clock times in `Asia/Tehran`. `sessions` are materialized UTC instants. Iran dropped DST in 2022, but we still convert through IANA tz (`@date-fns/tz`) and never hard-code +03:30.
- **Generation**: a nightly cron (and an immediate run when slots change) creates sessions for every active slot through **today + 10 weeks**. `INSERT … ON CONFLICT (slot_id, original_date) DO NOTHING`.
- **Single-session changes**: reschedule updates `starts_at/ends_at` and sets `is_override = true`, and keeps `original_date` so regeneration won't recreate it. Cancel sets `status = cancelled` with a reason. A cancelled session drops out of the exclusion constraint and the hour totals.
- **Slot edits / deletes**: apply from an effective date. We delete future `scheduled`, non-override sessions with no log or attendance, then regenerate. Overrides inside the range get flagged for review.
- **Validation** (shared function, used by slot create/edit, reschedule and one-off sessions):
  1. **Hard**: the DB exclusion constraint refuses overlapping sessions for the same teacher. We pre-check it to give a friendly message naming the conflicting class and time.
  2. **Soft warnings** (need an explicit "Save anyway"): any Tehran-local **day > 6 h**, any **week (Sat–Fri) > 29 h**, computed across the whole affected horizon. Counts every non-cancelled session kind.
- **Display**: `fa` shows the Jalali date with Persian digits (e.g. `شنبه ۲۱ مهر · ۱۸:۰۰`). `en` shows the Gregorian date. Times are always Tehran time, with the student's device time added when their device timezone differs [assumed].

---

## 6. i18n, RTL, mobile

**Routing (next-intl)**: `localePrefix: "always"`, `defaultLocale: "fa"`. `proxy.ts` sends `/` to the cookie locale or `fa`. The switcher swaps the prefix on the current path and sets the `NEXT_LOCALE` cookie. A logged-in user's `users.locale` also updates and wins on their next login. `<html lang dir>` is set in `app/[locale]/layout.tsx` (`fa → rtl`). The landing gets `hreflang` alternates.

**Messages**: `messages/fa.json` and `messages/en.json`, namespaced by feature. A CI check fails when keys are missing or extra. An ESLint rule (`no-literal-string` in JSX) stops hard-coded UI text.

**RTL rules**
- Only logical utilities: `ms/me/ps/pe/start/end/text-start`, `border-s`. ESLint and Stylelint ban `ml-*`, `left-*` and the like.
- Directional icons (arrows, chevrons, "next") get `rtl:-scale-x-100`. Non-directional ones (play, whale logo) don't flip.
- Mixed text such as English examples inside Persian notes: user content renders with `dir="auto"`, and we use `<bdi>` for names and numbers.
- Numbers come from `Intl.NumberFormat(locale)` (Persian digits plus Toman formatting). Inputs accept both Persian and Latin digits and normalize on parse.
- Jalali date picker: `react-multi-date-picker` (Persian calendar) for `fa`, same component in Gregorian for `en`.

**Fonts**: Self-hosted WOFF2 subsets in `public/fonts` via `@font-face` with `unicode-range` (Vazirmatn Arabic + Latin split), plus a preload of the main locale font (Vazirmatn variable, Barlow Condensed 600/700, Manrope variable), `font-display: swap`. Locale-scoped CSS variables: in `fa`, headings use Vazirmatn 800 (no uppercase or letter-spacing, since Persian has no case).

**Mobile strategy**: designed at 360–430 px first. Bottom nav on the student app and on admin mobile. Targets are ≥ 44 px. Lists replace tables under 768 px. Sheets replace modals. Safe-area insets (`env(safe-area-inset-bottom)`). Pages stay light: RSC by default, client JS only where needed. The test target is a low-end Android on 3G.

**Live classroom on phones (portrait)**
```
┌──────────────────────────────┐
│ B1 Evening · 23:41 · ●●○  ✕  │  top bar: name, timer, network quality, leave
├──────────────────────────────┤
│                              │
│   MAIN STAGE                 │  priority: screen share > active speaker > teacher
│   (pinch-zoom on share)      │
│                              │
├──────────────────────────────┤
│ [me] [Ali] [Sara] [Mona] →   │  horizontal tile strip, small; ✋ badge on tiles
├──────────────────────────────┤
│  🎤   📷   ✋   💬³   ⋯      │  control bar (≥ 48 px)
└──────────────────────────────┘
```
- **Pre-join screen**: camera/mic preview, device pick, speaker test. This tap also counts as the user gesture iOS needs before audio can play.
- **Chat**: bottom sheet with an unread badge. Raise hand goes through participant **attributes**, so late joiners see it. Chat stays in memory only [assumed].
- **"⋯" menu**: switch front/back camera, audio-only mode (stops subscribing to video, for weak networks), turn video off.
- **Landscape**: main stage fills the screen with the strip as an overlay. The Wake Lock API keeps the screen on, and the room reconnects automatically after iOS backgrounding.
- **Phone limits**: mobile browsers can't screen share (no `getDisplayMedia`), so screen sharing is a desktop feature for the teacher. Students publish 360p by default, the teacher 540p or 720p. Simulcast layers are `h180` and `h360`.
- **Teacher (desktop)**: a grid of 3 students with a mute, remove and lower-hand menu on each tile.

---

## 7. Deployment (Iranian VPS)

**Local first (no server needed for M1–M5)**
- `docker compose -f compose.dev.yml up` runs Postgres + `livekit-server --dev`, and the app runs with `pnpm dev` on the Mac.
- Phones on the same Wi-Fi can test the real UI. Camera and mic need HTTPS, so we use Caddy's local CA (`https://molingo.test`, a mkcert-style root installed on the test phones) or a LAN IP certificate.
- What local testing **can't** prove: Iranian mobile carriers, UDP blocking and TURN/TLS on 443. That's why the **VPS is rented before M6** (a month-to-month plan, ~2 vCPU / 4 GB, provider with good domestic peering, e.g. ArvanCloud, Asiatech, ParsPack), plus a domain. Buy the domain early (a `.ir` registration via nic.ir can take a few days).
- The Mac is arm64 and the VPS is amd64, so production images are always built with `--platform linux/amd64`.

**Domains**: `molingo.ir` (app), `lk.molingo.ir` (LiveKit signaling), `turn.molingo.ir` (TURN/TLS). DNS goes on a domestic provider (e.g. ArvanCloud DNS), because Cloudflare may be unreachable during cuts.

**Ports (firewall)**
| Port | Use |
|---|---|
| 80/tcp | ACME HTTP-01 + redirect |
| 443/tcp | HTTPS app + WSS signaling + **TURN/TLS**, all through Caddy layer4 SNI |
| 7881/tcp | LiveKit ICE/TCP fallback |
| 3478/udp | TURN/UDP |
| 50000–50200/udp | WebRTC media (narrow range is enough for about 4 users) |
| 22/tcp | SSH (keys only, fail2ban) |
| 5432, 3000, 7880 | **Bound to 127.0.0.1 only** |

**Compose outline**
```yaml
services:
  db:      { image: molingo/postgres:17-alpine, volumes: [pgdata:/var/lib/postgresql/data],
             ports: ["127.0.0.1:5432:5432"], command: postgres -c shared_buffers=256MB -c max_connections=30 }
  app:     { image: molingo/app:${TAG}, env_file: .env, depends_on: [db],
             volumes: [uploads:/data/uploads], ports: ["127.0.0.1:3000:3000"], mem_limit: 512m }
  livekit: { image: molingo/livekit:${LK_VER}, network_mode: host,
             volumes: [./livekit.yaml:/etc/livekit.yaml], command: --config /etc/livekit.yaml }
  caddy:   { image: molingo/caddy-l4:${CADDY_VER}, network_mode: host,
             volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data, ./certs:/certs:ro] }
volumes: { pgdata: {}, uploads: {}, caddy_data: {} }
```
`livekit.yaml` key points: `rtc.port_range_start/end 50000–50200`, `tcp_port 7881`, `use_external_ip: false` + explicit `node_ip` (no STUN lookup against Google), `turn.enabled`, `turn.domain turn.molingo.ir`, `turn.tls_port 5349`, `external_tls: true` (Caddy terminates), `udp_port 3478`, `webhook.urls: [http://127.0.0.1:3000/api/livekit/webhook]`, `room.max_participants 6`. Single node, so no Redis.

**RAM budget**: Postgres ~300 MB, app ~350 MB, LiveKit ~150 MB, Caddy ~50 MB, OS ~300 MB, about 1.2 GB in total. That fits 2 GB with **2 GB swap**. 4 GB is comfortable.

**Image strategy (no Docker Hub)**
1. Build on the dev machine or a CI runner outside Iran: `docker buildx build --platform linux/amd64`. The Caddy image comes from `xcaddy` + `caddy-l4`. The LiveKit image is the official Go binary (pinned version) on a minimal base.
2. Ship it: `docker save molingo/app:TAG … | zstd | ssh vps 'zstd -d | docker load'`. `scripts/ship.sh` wraps this with tagging, migrations (`drizzle-kit migrate` run inside the app image) and a `compose up -d`.
3. Fallback when international access is cut: domestic registry mirrors (e.g. ArvanCloud / Hamdocker mirrors) configured as `registry-mirrors`, plus a **local tarball cache** of every base image on the VPS (`/opt/molingo/images/`). LiveKit can also run as a plain systemd binary if needed.
4. **No build steps on the VPS**: no npm and no apt during deploys.

**TLS / Let's Encrypt fallback**
- Caddy auto-renews Let's Encrypt certs about 30 days before expiry, so an outage shorter than that does no harm. Let's Encrypt is also moving to shorter-lived certificates, which makes this buffer smaller over time.
- Fallback: buy a commercial DV certificate (the current maximum is about 200 days) for all 3 names and keep it in `./certs/`. A Caddyfile snippet (`tls /certs/fullchain.pem /certs/key.pem`) switches over with one command, documented in `RUNBOOK.md`.
- `/api/health` and the admin dashboard show cert expiry. A cron warns at 21 days remaining.

**Backups**
- `pg_dump -Fc` nightly → `/backups/pg/` (14 daily, 8 weekly). **restic** snapshots of `/backups` + `uploads`, encrypted, to a **domestic** target (ArvanCloud object storage or a second VPS). A foreign copy is optional, for when international access is up.
- Monthly **restore drill** into a scratch container, scripted (`scripts/restore-test.sh`).

**Security basics**: ufw, SSH keys only, unattended security updates, secrets in `.env` (0600), CSP with no external origins, honeypot + rate limit on public forms (no reCAPTCHA, since that's a Google service).

---

## 8. Milestones (build order)

Sizes: S ≈ 1–3 days, M ≈ 3–6 days, L ≈ 6–10 days (one developer with AI assistance).

| # | Milestone | Acceptance criteria | Size |
|---|---|---|---|
| M1 | Foundation (local) | Repo, Next 16, Tailwind tokens, fonts, `<Logo>` wordmark, next-intl fa/en + RTL shell, Drizzle + migrations, `compose.dev.yml`, CI (typecheck, lint, i18n key check). `/fa` and `/en` render with correct `dir`, Persian digits and Jalali date. | M |
| M2 | Auth | Mobile + password login/logout, phone normalization, activation and reset links, roles, rate limit, `requireX()` guards. Unit tests for authz helpers. | S |
| M3 | Landing | Design implemented in fa + en, live open classes (seats left), level-check → lead, AI waitlist (dedupes), FAQ. Lighthouse mobile ≥ 90, no external requests. | M |
| M4 | Students, classes, enrollment | CRUD, lead → student conversion, capacity enforced under concurrency (test), waitlist + promote. | M |
| M5 | Scheduling | Slots → sessions (10-week horizon, idempotent), reschedule/cancel, the DB refuses double-booking, 6 h/29 h warnings, admin week calendar, student schedule. Tests across Jalali month/year boundaries and Nowruz. | L |
| **M0** | **WebRTC test on the real VPS** (rent VPS + domain here) | LiveKit + Caddy-l4 + TURN/TLS deployed through the save/load pipeline. A bare test page lets 4 devices hold a 30-min call on MCI, Irancell, Rightel, home fiber/ADSL, VPN on and off, iOS Safari + Android Chrome. Pass: ≥ 95 % connect, audio OK on TURN/TLS-only (UDP blocked), CPU < 50 %. If it fails, switch provider before going further. | S |
| M6 | Live classroom (incl. 1:1 level-check rooms, Join Class, share links) | Token rules (§4), pre-join, phone portrait layout, chat, raise hand, teacher mute/remove, screen share (desktop), audio-only mode, reconnects. Manual matrix from M0 passes on the real app. | L |
| M7 | Attendance + session log | Webhooks → attendance with reconnects summed, idempotent on retries. Post-session log page (topics, summary, private and per-student notes). Student sees topics. | M |
| M8 | Homework | Assign (class or session, roster snapshot), attachments, submit text/file/voice, review queue, feedback, statuses. File authz tests. | M |
| M9 | Level & progress | Seeded A1–C2 stages + milestones, editor, quick tick list after a session, assessments + skill ratings, confirm promotion, student **My level** page with the wave/whale roadmap, admin overview. | L |
| M10 | Finance | Pricing models on classes (per-session / fixed course), price history, automatic end-of-month invoices (held + missed sessions charged, teacher-cancelled and "Not Charged" excluded), optional replacement session on cancel, course-fee invoices, review/adjust/issue, payments (partial allowed), Toman formatting, monthly/class/student income, overdue list. Tests for month boundaries and sessions that were rescheduled across months. | M |
| M11 | Dashboards | Admin and student dashboards per brief §3.12. | S |
| M12 | Hardening & launch | Backups + restore drill, TLS fallback rehearsed, a11y pass (keyboard, labels, AA contrast), low-end Android perf, `RUNBOOK.md`, seed Mona's real data. | M |

Total is roughly **10–13 weeks**. Phase 2 (whiteboard) and Phase 3 (AI) are designed in but not built. Excalidraw would sync over the same LiveKit data channel, with write permission handled through participant attributes, and the AI work would read the structured progress data from M9.

---

## 9. Risks & early tests

| Risk | Mitigation / early test |
|---|---|
| **UDP blocked or throttled on mobile carriers; TLS fingerprint/SNI filtering** | M0 tests on every carrier before any feature work. TURN/TLS on 443 behind a normal-looking domain. ICE/TCP 7881 fallback. Audio-only mode. We record connection type (`relay/tcp/udp`) per join for diagnostics. |
| International internet cut | Zero foreign runtime dependencies. CI check: build output plus a CSP report showing no external origins. Domestic DNS, backups and image mirror. Test by blocking egress on a staging box. |
| Let's Encrypt can't renew | 30-day buffer, commercial cert fallback, expiry alerts (§7). |
| iOS Safari quirks (autoplay, backgrounding, audio routing, camera permissions) | Pre-join gesture, reconnect handling, test on iOS 17 and 18+ devices in M0 and M6. |
| 2 GB RAM pressure / OOM | Off-box builds, `mem_limit`s, swap, Postgres tuning. LiveKit load test with 4 publishers. |
| Docker image delivery | Save/load pipeline proven in M0. Local tarball cache. |
| Timezone / Jalali bugs | Single date utility module with property tests (round-trip, year boundary, 29/30 Esfand). |
| RTL regressions | Lint bans physical CSS. Playwright screenshot tests for key pages in fa and en at 375 px. |
| Capacity race conditions | Row lock + test with parallel enroll requests. |
| Data loss | Nightly encrypted domestic backups + monthly restore drill. |

---

## 10. Open questions (remaining, all non-blocking)

Answered: logo, VPS timing, pricing models, absences, cancellations, replacement sessions, course fee timing, excused absences, class size, level check, class access, login.

I'll use these defaults unless you say otherwise:
1. **Skill rating scale**: 1–10.
2. **Seed level content**: I draft the sub-stages (A1.1–C2.3) and starter can-do milestones in English, and Mona edits them.
3. **Week** for the 29 h limit: Saturday–Friday.
4. **Chat**: not saved.
5. **Classmates**: students see first names only.
6. **Times**: Tehran time, plus the device's local time as a second line when it differs.

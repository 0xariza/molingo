# Live Classroom Test Plan

## Application Overview

Learners open the room from **Join class** on the next-session card (dashboard and "My schedule"),
which appears from 15 minutes before a session until it ends. Mona opens it from **Enter the room**
on the class page's "on now" banner (and the schedule card); she may enter from an hour before
until 30 minutes after the end. `/app/classroom/[id]` and `/admin/classroom/[id]` check the join
rule (PLAN §4) on the server: a learner needs a place in the class (regular sessions) or an
invitation (make-ups), the session must be scheduled and inside the window, and Mona must not
have removed them. Outside the window the page says why ("The room opens at 18:45"); someone
with no claim to the session gets the not-found page.

The pre-join screen shows the class, a camera preview with microphone level, device pickers, a
speaker test, **Join class** and **Join with audio only**. Joining needs the LiveKit server, which
the e2e build doesn't run: the room itself (video, chat, raise hand, Mona's turn / mute / remove,
screen share, audio-only, reconnects) is covered by the integration tests for the join rule and
tokens, and by the manual device matrix from M0 on the real VPS.

Seed (`seedClassroom` in `e2e/fixtures.ts`): Mona (admin, teacher record), Sara (learner with a
login) in "Morning A2" (regular sessions next week), and a one-hour make-up for Sara starting a
given number of minutes from now. Tests run in English on phones.

## Test Scenarios

### 1. Getting into the room

**Seed:** `e2e/seed.spec.ts`

#### 1.1. learner-joins-from-the-dashboard

**File:** `e2e/classroom/learner-joins-from-the-dashboard.spec.ts`

**Steps:**

1. Seed a make-up that started 10 minutes ago; log in as Sara - expect: the next-session card says
   "On now" and has a "Join class" link
2. Follow "Join class" - expect: the URL is `/en/app/classroom/<id>`, the heading "Ready to join the
   class?", the class "Morning A2 · A2", and the buttons "Join class" and "Join with audio only
   (weak internet)"
3. Press "Back" - expect: the dashboard

#### 1.2. room-opens-15-minutes-before

**File:** `e2e/classroom/room-opens-15-minutes-before.spec.ts`

**Steps:**

1. Seed a make-up starting in 2 hours; log in as Sara - expect: no "Join class" link on the
   dashboard
2. Open `/en/app/classroom/<id>` directly - expect: the heading "The room isn't open" and "The room
   opens at <start − 15 min> (Tehran time)."

#### 1.3. mona-enters-from-the-class-page

**File:** `e2e/classroom/mona-enters-from-the-class-page.spec.ts`

**Steps:**

1. Seed a make-up that started 10 minutes ago; log in as Mona, open the class page - expect: the
   "on now" banner with "Enter the room"
2. Follow it - expect: `/en/admin/classroom/<id>` and the pre-join heading

### 2. Access rules

#### 2.1. classroom-is-only-for-its-people

**File:** `e2e/classroom/classroom-is-only-for-its-people.spec.ts`

**Steps:**

1. Seed a make-up that is on now; log in as Sara and open `/en/admin/classroom/<id>` - expect:
   redirected to `/en/app`
2. Log out; log in as another learner with no place in the class and open
   `/en/app/classroom/<id>` - expect: the not-found page

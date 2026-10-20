# Classes Test Plan

## Application Overview

Mona creates classes on `/admin/classes/new`: Persian and English names (English optional), level
(six buttons), private (1 learner, priced per session) or
group (2–4 learners, priced per learner for the whole course), total sessions, session length, weekly
rows of day + typed start time, and a start date picked from a calendar that only allows those days
(Persian calendar in Persian, Gregorian in English). Learners can be added while creating. The app
generates every session and shows the last one.

`/admin/classes` opens with stat tiles, two charts and class cards (the whole card opens the class; a
quiet "Add learner" button opens a searchable picker). The class page lists sessions (cancel before a
session starts; mark it held with attendance — present, absent (charged), excused (not charged) —
once it has started), learners (add with search, move to another class with free seats, end a place),
details and past learners. A make-up session is added by hand on `/admin/classes/[id]/makeup`, with
a clash check against all of Mona's sessions. "Continue with next course" unlocks once no session is
left to run. There is no waitlist: a full class takes nobody. Students never reach these pages.

## Test Scenarios

### 1. Classes

**Seed:** `e2e/seed.spec.ts`

#### 1.1. create-group-class

**File:** `e2e/classes/create-group-class.spec.ts`

**Steps:**

1. Log in as Mona, open `/en/admin/classes`, press "New class" - expect: the "New class" heading
2. Fill "Class name in Persian" with "صبح A2" and "Class name in English" with "Morning A2", press
   the "A2" level button - expect: it is pressed
3. Press "Add day and time" twice; set the second row's day to "Monday"; type "08:00" in both start
   times (the end time per row only shows on wider screens)
4. Open "Start date", pick next week's Saturday - expect: days that aren't Saturday or Monday are
   disabled - expect: "Last session" shows the sixth Monday
5. Type the tuition "6500000" - expect: it shows "6,500,000"; press "Create class" - expect: the class
   page with the heading "Morning A2" and "0 of 12 held"

#### 1.2. class-needs-a-valid-schedule

**File:** `e2e/classes/class-needs-a-valid-schedule.spec.ts`

**Steps:**

1. Open `/en/admin/classes/new`, press "Create class" with nothing filled - expect: errors for the
   Persian name, the days and times ("Add at least one day and time."), the start date and the
   tuition - expect: still on the form
2. Add a row with the time "25:00" - expect: the time field is marked invalid

#### 1.3. clash-with-another-class-is-refused

**File:** `e2e/classes/clash-with-another-class-is-refused.spec.ts`

**Steps:**

1. With a class on Saturdays 08:00–09:30, create another on Saturdays at 09:00 starting the same day -
   expect: the alert "Clashes with Morning A2 on …"

#### 1.4. add-learner-from-card

**File:** `e2e/classes/add-learner-from-card.spec.ts`

**Steps:**

1. With a group class (capacity 2) and learners Sara and Arash, open `/en/admin/classes`, press "Add a
   learner to Morning A2" - expect: a dialog with a search box
2. Type "0919" - expect: only Arash is listed; pick him and press "Add to class" - expect: the card
   shows "1 of 2 seats"

#### 1.5. full-class-takes-nobody

**File:** `e2e/classes/full-class-takes-nobody.spec.ts`

**Steps:**

1. With a full group class, open its page - expect: "The class is full. Raise its capacity in Edit
   class to add more." and no search box - expect: the card on `/en/admin/classes` says "Class is
   full"

#### 1.6. cancel-session-and-add-make-up

**File:** `e2e/classes/cancel-session-and-add-make-up.spec.ts`

**Steps:**

1. On a class page, press "Cancel" on session 1, type a reason, press "Cancel session" - expect:
   session 1 shows "Cancelled" and "Cancelled by you: “…” · not charged"
2. Press "Add replacement" - expect: the make-up page with "Session 1 · cancelled" chosen
3. Pick a day and type a time that overlaps the class - expect: "Clashes with …"; change the time to a
   free one - expect: "You're free: …"; press "Add make-up session" - expect: back on the class page
   with "Make-up for session 1" - expect: session 1 no longer offers "Add replacement"

#### 1.7. mark-session-held-with-attendance

**File:** `e2e/classes/mark-session-held-with-attendance.spec.ts`

**Steps:**

1. With a class whose first session has ended and two learners, open the class page - expect: session
   1 shows "Needs confirming"
2. Press "Mark as held", set the second learner to "Excused" - expect: "Charged for this session: 1 of
   2"; press "Confirm: session held" - expect: "1 present · 0 absent (charged) · 1 excused"

#### 1.8. move-learner-to-another-class

**File:** `e2e/classes/move-learner-to-another-class.spec.ts`

**Steps:**

1. With Sara in class A and a class B with a free seat, press "Move Sara to another class", pick B,
   press "Confirm move" - expect: Sara is no longer in A's learners - expect: her profile's Classes
   card shows B "In class" and A "Ended"

#### 1.9. next-course-only-after-the-last-session

**File:** `e2e/classes/next-course-only-after-the-last-session.spec.ts`

**Steps:**

1. On a running class - expect: "Continue with next course" is disabled with "Unlocks after the last
   session (…)"
2. With every session held - expect: it's a link; follow it - expect: "Continue with next course" form
   with the level one higher and the same learners; press "Create class" - expect: the new class page
   with the same learners

#### 1.10. persian-class-form

**File:** `e2e/classes/persian-class-form.spec.ts`

**Steps:**

1. Open `/fa/admin/classes/new` - expect: the heading "کلاس جدید" - expect: the page is right-to-left
2. Add a day and open "تاریخ شروع" - expect: a Persian calendar (Jalali month name, Persian digits)

#### 1.11. student-cannot-open-classes

**File:** `e2e/access/student-cannot-open-classes.spec.ts`

**Steps:**

1. Log in as Sara (student), open `/en/admin/classes` - expect: the URL is `/en/app`

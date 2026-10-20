# Weekly Schedule Test Plan

## Application Overview

`/admin/schedule` shows Mona's Sat–Fri week in Tehran time (`?w=-1`, `?w=1` … move by weeks). A
panel shows the week's hours against her 29 h limit and a colour key; each day shows its hours
against 6 h. Every session and every level-check time is a card: the bar on its start side is blue
(group), purple (private), orange (make-up), yellow (booked level check) or red (cancelled); open
level-check times are dashed. On phones one day shows at a time, picked from seven day buttons.

Opening a card: an upcoming session can be **moved** (another day of the week shown, a typed start
time, same length; clashes block, more than 6 h on a day is a warning) or **cancelled** (optional
reason). A booked level check shows the mobile, level guess and how it was booked, with **Cancel
booking** (the time opens again). An open time can be **given** to someone waiting or to a new person
(name + mobile) or **removed**. "+ Open time" under today and later days adds a 20-minute time.

Learners see `/app/schedule` ("My schedule"): the next session card (Tehran time, and device time
when it differs) and two weeks of sessions by day; cancelled ones show the reason and "not charged",
moved ones say from when. The learner home shows the next session.

Seed (`seedSchedule` in `e2e/fixtures.ts`): Mona (admin) with a teacher record; a group class
"Morning A2" on Saturdays and Mondays 10:30–12:00 with learner Sara (who has a login), starting
next week; level-check times next Monday 18:00 (open) and next Tuesday 18:00 (booked online by
"Nika Rahimi"); a lead "Mahsa", added by Mona, with no time. The server's clock can't be faked in
the production build, so everything sits in **next week** (`?w=1`), which is always fully ahead.
Tests run in English unless stated, on phones: pick a day from the seven day buttons to see its
cards.

## Test Scenarios

### 1. Week calendar

**Seed:** `e2e/seed.spec.ts`

#### 1.1. week-shows-sessions-and-level-checks

**File:** `e2e/schedule/week-shows-sessions-and-level-checks.spec.ts`

**Steps:**

1. Log in as Mona, open "Weekly schedule" in the menu - expect: the heading "This week" and the
   week's date range
2. Press the next-week arrow - expect: the heading "Next week" and the URL ends with `?w=1`
3. Look at Saturday - expect: a "Morning A2" card "10:30–12:00"; Monday - expect: "Morning A2" and a
   dashed "Open time" card at 18:00; Tuesday - expect: a "Nika Rahimi" card with "Level check ·
   booked online"
4. Read the hours panel - expect: "3:20 of 29 h" (two 90-minute sessions and one booked level check)
5. Press "This week" - expect: back to "This week"

#### 1.2. persian-week-is-right-to-left

**File:** `e2e/schedule/persian-week-is-right-to-left.spec.ts`

**Steps:**

1. Open `/fa/admin/schedule?w=1` - expect: the heading "هفته‌ی بعد", Saturday ("شنبه") is the
   rightmost day button, times use Persian digits ("۱۰:۳۰ تا ۱۲:۰۰")

### 2. Moving and cancelling

**Seed:** `e2e/seed.spec.ts`

#### 2.1. move-a-session

**File:** `e2e/schedule/move-a-session.spec.ts`

**Steps:**

1. Open the Monday "Morning A2" card - expect: a dialog with "Move" and "Cancel"
2. Press "Move", pick Wednesday, type "16:00" - expect: "until 17:30" and the note "You're free.
   Wed comes to 1:30 of 6 h."
3. Press "Move session" - expect: the dialog closes; Wednesday shows "Morning A2" 16:00–17:30 with
   "Moved"; Monday no longer shows it
4. Open it again - expect: "First set for" with Monday 10:30

#### 2.2. move-is-blocked-by-a-clash

**File:** `e2e/schedule/move-is-blocked-by-a-clash.spec.ts`

**Steps:**

1. Open the Monday "Morning A2" card, press "Move", pick Monday, type "17:30" - expect: the alert
   "Clashes with “Open level-check time” (18:00)" and "Move session" disabled
2. Pick Tuesday, type "17:00" - expect: "Clashes with “Level check · Nika Rahimi” (18:00)"
3. Type "16:00" - expect: "You're free." and "Move session" enabled

#### 2.3. cancel-a-session

**File:** `e2e/schedule/cancel-a-session.spec.ts`

**Steps:**

1. Open the Monday "Morning A2" card, press "Cancel", type the reason "I'm unwell", press "Cancel
   session" - expect: the card shows "Cancelled", its title struck through, and the hours drop by 1:30 (to 1:50)
2. Log in as Sara, open "My schedule" - expect: the Monday session says "Cancelled: “I'm unwell” · not
   charged"

### 3. Level-check times

**Seed:** `e2e/seed.spec.ts`

#### 3.1. add-an-open-time

**File:** `e2e/schedule/add-an-open-time.spec.ts`

**Steps:**

1. Press "+ Open time" under Thursday, type "11:00" - expect: "20 min · until 11:20"; press "Add open
   time" - expect: a dashed "Open time" card at 11:00 on Thursday
2. Press "+ Open time" under Saturday, type "10:40" - expect: the alert "Clashes with “Morning A2”
   (10:30)" and the add button disabled
3. Open the previous week - expect: no "+ Open time" button (days that have passed)

#### 3.2. give-an-open-time-to-someone

**File:** `e2e/schedule/give-an-open-time-to-someone.spec.ts`

**Steps:**

1. Open the Monday "Open time" card - expect: "Who gets this time?" with "Mahsa" listed
2. Type "mah" in the search - expect: only "Mahsa"; pick her, press "Book for Mahsa" - expect: the
   card becomes "Mahsa" with "Level check · booked by you"

#### 3.3. book-for-someone-new

**File:** `e2e/schedule/book-for-someone-new.spec.ts`

**Steps:**

1. Open the Monday "Open time" card, pick "Someone new", type the name "Sina" and the mobile "123",
   press "Book for Sina" - expect: "That mobile number isn't valid." under the mobile field, which
   keeps "123"
2. Type "09352104417", press "Book for Sina" - expect: a "Sina" card on Monday

#### 3.4. cancel-a-booking-reopens-the-time

**File:** `e2e/schedule/cancel-a-booking-reopens-the-time.spec.ts`

**Steps:**

1. Open the Tuesday "Nika Rahimi" card, press "Cancel booking", confirm - expect: Tuesday 18:00 is a
   dashed "Open time" again and the hours drop by 0:20
2. Open that time - expect: "Nika Rahimi" is listed under people waiting
3. Press "Remove this time" - expect: the card is gone

### 4. Learner schedule

**Seed:** `e2e/seed.spec.ts`

#### 4.1. learner-sees-the-next-two-weeks

**File:** `e2e/schedule/learner-sees-the-next-two-weeks.spec.ts`

**Steps:**

1. Log in as Sara - expect: the home page shows "Next session" with "Morning A2 · A2" and "Tehran
   time", and a "Full schedule" link
2. Open "My schedule" - expect: sessions over the next two weeks, grouped by day, each with
   "Session n of 12" (next Saturday is session 1, next Monday session 2)
3. With the browser time zone set to Europe/London - expect: "Your device time:" under the next
   session; with Asia/Tehran - expect: no device-time line

#### 4.2. moved-session-shows-for-the-learner

**File:** `e2e/schedule/moved-session-shows-for-the-learner.spec.ts`

**Steps:**

1. With Monday's session moved to Wednesday 16:00 (set in the database; moving in the UI is 2.1)
2. As Sara, open "My schedule" - expect: Wednesday shows "Morning A2" 16:00 with "Moved" and "Moved
   from Mon …" - expect: Monday has no session

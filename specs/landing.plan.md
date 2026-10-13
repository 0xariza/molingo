# Landing Page Test Plan

## Application Overview

The public landing page (Persian default, English) sells Molingo around two promises: a personal
roadmap for each learner's goal and an AI assistant (coming soon) across the learning loop. Sections:
hero, highlights, an interactive sample roadmap (pick a goal, the stops change), the AI assistant with
its waitlist, a sample week, class formats (private and group; open groups show a "forming" state until
M4/M5), free-session booking, about Mona, FAQ and a closing call to action.

Booking works like Calendly: visitors see only the times Mona opened (next two weeks, Tehran time),
pick a day and a time, then leave a name, mobile number and level. The booking saves a `scheduled`
lead and takes the slot, so nobody else can book it. Mona adds and removes free times on
`/admin/level-checks` and sees who booked. Both public forms have a honeypot and rate limits.

## Test Scenarios

### 1. Landing page

**Seed:** `e2e/seed.spec.ts`

#### 1.1. landing-shows-every-section

**File:** `e2e/landing/landing-shows-every-section.spec.ts`

**Steps:**

1. Open `/en` - expect: section headings for the roadmap, AI assistant, sample week, class formats,
   booking and FAQ - expect: the group card shows "New groups are forming" - expect: the hero's
   "Get my free roadmap" link points to the booking section (`#book`)

#### 1.2. roadmap-changes-with-the-goal

**File:** `e2e/landing/roadmap-changes-with-the-goal.spec.ts`

**Steps:**

1. Open `/en` - expect: "Work & interviews" is pressed and its first stop is shown
2. Press "Moving abroad" - expect: it is pressed - expect: the moving-abroad stops replace the
   interview stops

#### 1.3. booking-saves-lead-and-takes-slot

**File:** `e2e/landing/booking-saves-lead-and-takes-slot.spec.ts`

**Steps:**

1. With one open time tomorrow at 18:00 (Tehran), open `/en`, press the "18:00" time - expect: the
   summary names tomorrow and 18:00
2. Fill name, mobile number (with spaces) and level, press "Confirm my session" - expect: the
   "Booked" status message - expect: one `scheduled` lead with the normalized number, level and locale
   `en`, and the slot now belongs to it

#### 1.4. booking-validates-fields

**File:** `e2e/landing/booking-validates-fields.spec.ts`

**Steps:**

1. With one open time, pick it, enter a one-letter name and an invalid number, submit - expect: name
   and phone errors, fields marked invalid - expect: the typed values are kept - expect: nothing is
   saved and the slot stays free

#### 1.5. booking-ignores-bots

**File:** `e2e/landing/booking-ignores-bots.spec.ts`

**Steps:**

1. Pick a time, fill the form correctly and also the hidden honeypot field, submit - expect: the
   "Booked" message (bots get no hint) - expect: no lead is saved and the slot stays free

#### 1.6. persian-booking

**File:** `e2e/landing/persian-booking.spec.ts`

**Steps:**

1. On `/fa`, pick the "۱۸:۰۰" time, fill the form with the number in Persian digits, submit - expect:
   the Persian "booked" message - expect: the lead is saved with the normalized number and locale `fa`

#### 1.7. taken-time-is-refused

**File:** `e2e/landing/taken-time-is-refused.spec.ts`

**Steps:**

1. With two open times, open `/en` and pick 18:00; meanwhile someone else books 18:00 - expect: (setup)
2. Fill the form and submit - expect: the "Someone just took that time" alert - expect: 18:00 is no
   longer offered, 19:00 still is - expect: only the other person's lead exists

#### 1.8. no-open-times

**File:** `e2e/landing/no-open-times.spec.ts`

**Steps:**

1. With no open times (one past, one booked), open `/en` - expect: the "All of Mona's times are taken"
   message and no booking form

#### 1.9. waitlist-joins-once

**File:** `e2e/landing/waitlist-joins-once.spec.ts`

**Steps:**

1. Enter an invalid email, press "Notify me" - expect: the email error
2. Enter a valid email, submit - expect: the "You're on the list" status
3. Reload and join again with the same email in different case - expect: the same success message -
   expect: exactly one waitlist row

### 2. Mona's free-session times

**Seed:** `e2e/seed.spec.ts`

#### 2.1. admin-adds-and-removes-a-time

**File:** `e2e/landing/admin-adds-and-removes-a-time.spec.ts`

**Steps:**

1. Log in as Mona, open "Free sessions" from the panel menu - expect: "You haven't added any
   times yet"
2. Choose tomorrow, enter 18:30, press "Add" - expect: "Added." - expect: tomorrow 18:30 is listed as
   free
3. Add the same time again - expect: the overlap error
4. Remove it - expect: the empty message again

#### 2.2. admin-sees-who-booked

**File:** `e2e/landing/admin-sees-who-booked.spec.ts`

**Steps:**

1. With a booked time, log in as Mona and open `/en/admin/level-checks` - expect: the time shows
   "Booked" with the visitor's name, number and level, and no "Remove" button

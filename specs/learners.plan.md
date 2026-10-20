# Learners Test Plan

## Application Overview

Mona manages her learners (زبان‌آموز, "Learners" in English) on `/admin/students`. The page opens with
stat tiles (active learners, new this month, free session → learner, logins not used yet) and two
charts (new learners per Jalali month for the last 6 months; learners by status with the booking
conversion). Below are the free-session bookings still to follow up ("Add as learner" or "Not
interested"), status filter chips, a search (Persian or English name, or mobile number as typed) and
the list, newest first.

A learner has a full name in Persian (required) and in English (optional), a mobile number (one
learner per number), optional email and Telegram/WhatsApp handle, private notes and a status
(`lead|active|paused|left`). Adding a learner can create their login at once: Mona then sees a
one-time activation link (copy, WhatsApp, Telegram) that is never shown again. On the profile she can
create a login later, issue a new activation link (or a password-reset link once they have a
password), and change the status: "Left" turns the login off and signs them out; any other status
turns it back on. Students can never open these pages.

## Test Scenarios

### 1. Learners

**Seed:** `e2e/seed.spec.ts`

#### 1.1. booking-becomes-learner-with-login

**File:** `e2e/learners/booking-becomes-learner-with-login.spec.ts`

**Steps:**

1. With a booking by "Nika Rahimi" (+989125551234) tomorrow at 18:00, log in as Mona and open
   `/en/admin/students` - expect: "Free sessions to follow up" lists Nika Rahimi
2. Press "Add Nika Rahimi as a learner" - expect: the "Add learner" heading - expect: the English name
   is "Nika Rahimi" and the mobile is "0912 555 1234"
3. Fill "Full name in Persian" with "نیکا رحیمی", keep "Create their login now" ticked, press
   "Save learner" - expect: "نیکا رحیمی is saved." - expect: a "Login link" textbox whose value
   contains `/fa/activate/` - expect: "Send on WhatsApp" links to `wa.me/989125551234`
4. Press "Open profile" - expect: the heading "Nika Rahimi" - expect: the login state "Link sent · not
   used" - expect: the link is no longer shown

#### 1.2. activation-link-from-profile-works

**File:** `e2e/learners/activation-link-from-profile-works.spec.ts`

**Steps:**

1. With learner Arash (no login), log in as Mona and open his profile - expect: "No login"
2. Press "Create login" - expect: a "Login link" textbox; read its value
3. Log out, open the link (it is in Persian, the default for a new login), set a password twice,
   save - expect: the URL is `/fa/app`

#### 1.3. duplicate-mobile-is-refused

**File:** `e2e/learners/duplicate-mobile-is-refused.spec.ts`

**Steps:**

1. With learner Arash on 0919 450 7781, log in as Mona and open `/en/admin/students/new`
2. Fill the Persian name, mobile "۰۹۱۹ ۴۵۰ ۷۷۸۱", untick "Create their login now", save - expect: the
   alert "Another learner already has this mobile number." with an "Open their profile" link
   - expect: the typed name is still in the field

#### 1.4. form-validates-fields

**File:** `e2e/learners/form-validates-fields.spec.ts`

**Steps:**

1. Log in as Mona, open `/en/admin/students/new`, press "Save learner" with empty fields - expect:
   the Persian-name and mobile errors under their fields - expect: still on the form

#### 1.5. not-interested-closes-booking

**File:** `e2e/learners/not-interested-closes-booking.spec.ts`

**Steps:**

1. With a booking by "Nika Rahimi", log in as Mona, open `/en/admin/students`, press "Nika Rahimi is
   not interested" - expect: the follow-up section is gone

#### 1.6. left-turns-login-off

**File:** `e2e/learners/left-turns-login-off.spec.ts`

**Steps:**

1. With Sara as a learner with a login, log in as Mona and open her profile, press "Left" - expect:
   "Left" is pressed - expect: the login state "Login off"
2. Log out and log in as Sara - expect: the login error (account turned off)
3. As Mona, press "Active" on her profile - expect: "Has logged in"

#### 1.7. filter-and-search

**File:** `e2e/learners/filter-and-search.spec.ts`

**Steps:**

1. With an active learner Sara and a lead Arash, log in as Mona, open `/en/admin/students` - expect:
   both listed - expect: the "Active learners" tile shows 1
2. Press the "Lead" filter - expect: only Arash - expect: the URL has `status=lead`
3. Press "All", search "۰۹۱۲ ۰۰۰" - expect: only Sara

#### 1.8. edit-details

**File:** `e2e/learners/edit-details.spec.ts`

**Steps:**

1. With learner Sara, log in as Mona, open her profile, press "Edit details", change the English name
   to "Sara A.", save - expect: back on the profile with the heading "Sara A."

#### 1.9. persian-learners-page

**File:** `e2e/learners/persian-learners-page.spec.ts`

**Steps:**

1. Log in as Mona and open `/fa/admin/students` - expect: the heading "زبان‌آموزها" - expect: the page
   is right-to-left - expect: the nav has "زبان‌آموزها" as the current page

#### 1.10. student-cannot-open-learners

**File:** `e2e/access/student-cannot-open-learners.spec.ts`

**Steps:**

1. Log in as Sara (student), open `/en/admin/students` - expect: the URL is `/en/app`

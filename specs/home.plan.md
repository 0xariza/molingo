# Platform Home Page Test Plan

## Application Overview

`hoopo.ir` is the platform page for teachers (M6d), shown when `PLATFORM_HOME=on` (on in the e2e
build; off in production until its placeholders are real, when it redirects to Mona's page).
Teachers can't sign up yet: **Request early access** (name, mobile, how many learners) saves a
teacher lead, which the owner sees under "Early access requests" on `/owner`.

## Test Scenarios

### 1. Early access

**Seed:** `e2e/seed.spec.ts`

#### 1.1. teacher-requests-early-access

**File:** `e2e/home/teacher-requests-early-access.spec.ts`

**Steps:**

1. Open `/en`, press "Request early access" with the fields empty - expect: the name, mobile and
   learners errors
2. Fill Neda, 0912 555 0001, 12 and submit - expect: "Thanks! We'll call you soon…"
3. Log in as the owner - expect: `/en/owner` lists Neda with "12 learners now"

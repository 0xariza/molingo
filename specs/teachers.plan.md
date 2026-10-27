# Teachers Test Plan

## Application Overview

The platform owner (role `owner`, `/owner`) adds teachers: Persian and English name, brand name,
mobile and page address. Saving makes a one-time activation link to send; the teacher sets a
password and lands in their own, empty panel (`/admin`). Every teacher sees only their own
learners, classes, sessions and bookings (PLAN, Multi-teacher). A learner is one person per mobile
number: when a second teacher adds a number that is already someone's learner, both teachers
are linked to the same person, each with their own status and private notes.

Seed: the owner (created in the test) and Mona (`seedTeaching`: teacher at `/mona` with Sara as
an active learner who has a login).

## Test Scenarios

### 1. Two teachers

#### 1.1. owner-adds-a-teacher-who-shares-a-learner

**File:** `e2e/teachers/owner-adds-a-teacher-who-shares-a-learner.spec.ts`

**Steps:**

1. Log in as the owner - expect: `/en/owner`, Mona English in the list
2. Fill "Add a teacher" (Ali, علی, Ali Talks, 0935 000 0009, `ali`) and submit - expect: Ali
   Talks listed as "Not activated" and an activation link to copy
3. Open the link, set a password - expect: `/en/admin`, and the learners page lists nobody
4. Add a learner with Sara's number and a private note - expect: her profile shows Ali's note
5. Open `/en/ali` - expect: the page names Ali, never Mona
6. Log in as Mona and open Sara - expect: Ali's note isn't there

# Homework Test Plan

## Application Overview

A teacher gives homework for a **held** session (from the session's row on the class page, or
from Homework in the nav); it goes to the class's active learners at that moment. Learners hand
in text, files and a voice recording until the teacher reviews it; the teacher answers with text
feedback (no score) or asks for a revision. Files are served only through `/api/files/[id]`.
The learner area gains Classes, Profile and Settings behind an avatar menu (PLAN, Homework / M8).

Seed: Mona with a group class of two active learners (Sara and Ali, both with logins) whose first
session is held (`seedTeaching` + a held session).

## Test Scenarios

### 1. Give, hand in, review

#### 1.1. teacher-assigns-learner-hands-in-teacher-reviews

**File:** `e2e/homework/teacher-assigns-learner-hands-in-teacher-reviews.spec.ts`

**Steps:**

1. Log in as Mona, open the class page, click Homework on session 1 - expect: the dialog says it
   goes to both learners, with a suggested deadline an hour before the next session
2. Fill the title and instructions, attach a PDF, submit - expect: the dialog closes and the row
   reads "Homework · 1"
3. Log in as Sara - expect: Homework in the nav carries a badge of 1; the list shows the task
   under "To do"
4. Open it, type an answer, attach a file, send - expect: it moves to "Handed in"
5. Log in as Mona, open Homework - expect: 1 to review; open it - expect: Sara's answer and file
6. Ask for a revision with no feedback - expect: "Write feedback to ask for a revision"
7. Write feedback and ask for a revision - expect: the queue is empty
8. As Sara - expect: "Needs revision" with Mona's feedback; edit the answer and send again
9. As Mona, mark it reviewed - expect: it is listed under Reviewed
10. As Sara - expect: the answer can no longer be edited and Mona's feedback is shown

### 2. Authorization

#### 2.1. files-are-private-to-their-teacher-and-learners

**File:** `e2e/homework/files-are-private-to-their-teacher-and-learners.spec.ts`

**Steps:**

1. Sara hands in an answer with a file; note the file's `/api/files/<id>` address
2. Open the address as Sara and as Mona - expect: the file downloads
3. Open it as Ali (same class) and as another teacher - expect: 404
4. Open it logged out - expect: 404

### 3. Learner account

#### 3.1. learner-changes-password-and-language

**File:** `e2e/homework/learner-changes-password-and-language.spec.ts`

**Steps:**

1. Log in as Sara, open the avatar menu - expect: Profile, Settings, Log out
2. Open Profile - expect: her names, number, email and Mona; nothing is editable
3. Open Settings, switch to English - expect: the page and nav are English
4. Change the password with a wrong current password - expect: "Your current password isn't right."
5. Change it correctly - expect: "Password changed."; logging in with the new password works

**Not written yet:** the three `e2e/homework/*.spec.ts` files above. Per the standards they follow
this plan via the playwright-cli workflow; they have not been generated or run.

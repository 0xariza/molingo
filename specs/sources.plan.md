# Sources Test Plan

## Application Overview

Mona keeps her books on `/admin/sources` (sidebar "Sources"). "New source" (`/admin/sources/new`)
asks for the source name, its level, how many chapters it has and the suggested sessions per
chapter; creating it makes one empty station per chapter and opens the source map
(`/admin/sources/[id]`). The map lists the stations with "Complete" / "Incomplete" badges and edits
one station at a time: its name, where it is in the book, suggested sessions (1–4) and 3–4 skills.
A station is complete with a name and at least three skills. Stations can be moved, added after the
open one and deleted (the last one stays). Learners never reach these pages.

## Test Scenarios

### 1. Sources

**Seed:** `e2e/seed.spec.ts`

#### 1.1. create-source-map

**File:** `e2e/sources/create-source-map.spec.ts`

**Steps:**

1. Log in as Mona, open `/en/admin/sources`, press "New source" - expect: the "New source" heading
2. Fill "Source name" with "Sample Book 2", press "A2", press "One less" under "Chapters" until it
   shows 2 - expect: the preview says "2 stations"
3. Press "Create stations" - expect: the map with the heading "Sample Book 2" and "0 of 2 complete"
4. Fill "Station name" with "I can talk about my past", fill skills 1–3, press "Save station" -
   expect: "Saved." and "1 of 2 complete"; the first station in the list is "Complete"
5. Open `/en/admin/sources` - expect: "Sample Book 2" with "1 of 2 complete"

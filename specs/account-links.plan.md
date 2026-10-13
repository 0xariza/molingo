# Activation and Reset Links Test Plan

## Application Overview

Mona gives each student a one-time activation link to choose a password (7 days), and a reset link
when they forget it (24 hours). A link works once, only for its own purpose, and only while the
account is active. Setting the password signs the user in. Passwords need 8+ characters and must not
be common or the user's phone number.

## Test Scenarios

### 1. Activation link

**Seed:** `e2e/seed.spec.ts`

#### 1.1. activation-sets-password-once

**File:** `e2e/account-links/activation-sets-password-once.spec.ts`

**Steps:**

1. Create user Nika without a password and an activation link; open the link - expect: the heading greets Nika
2. Enter a new password twice, press "Save and continue" - expect: the URL is `/en/app`
3. Open the same link again - expect: the heading says the link doesn't work anymore

#### 1.2. activation-validates-password

**File:** `e2e/account-links/activation-validates-password.spec.ts`

**Steps:**

1. Submit "short" twice - expect: "at least 8 characters" error
2. Submit "12345678" twice - expect: "too easy to guess" error
3. Submit two different passwords - expect: "don't match" error

#### 1.3. expired-or-made-up-link-is-refused

**File:** `e2e/account-links/expired-or-made-up-link-is-refused.spec.ts`

**Steps:**

1. Open an activation link that expired a second ago - expect: the "link doesn't work anymore" heading
2. Open a made-up link - expect: the same heading

### 2. Reset link

**Seed:** `e2e/seed.spec.ts`

#### 2.1. reset-replaces-old-password

**File:** `e2e/account-links/reset-replaces-old-password.spec.ts`

**Steps:**

1. Open Sara's reset link, set a new password - expect: the URL is `/en/app`
2. Log out; log in with the old password - expect: the "incorrect" alert
3. Log in with the new password - expect: the URL is `/en/app`

#### 2.2. activation-link-is-not-a-reset-link

**File:** `e2e/account-links/activation-link-is-not-a-reset-link.spec.ts`

**Steps:**

1. Open Sara's activation token on the `/en/reset/…` page - expect: the "link doesn't work anymore" heading

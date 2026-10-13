# Login and Access Test Plan

## Application Overview

Everyone logs in with a mobile number and a password. Mona is `admin` (lands on `/admin`), students
land on `/app`. Errors never reveal whether a number has an account. Five failed attempts lock a
number for 15 minutes. Protected areas send visitors to `/login?next=…`, and roles can't enter each
other's areas.

Test data: Mona `09120000001` (admin) and Sara `09120000002` (student), both with the e2e password,
created by the `seedAccounts` fixture. The database is reset before every test.

## Test Scenarios

### 1. Login with mobile number and password

**Seed:** `e2e/seed.spec.ts`

#### 1.1. admin-logs-in

**File:** `e2e/auth/admin-logs-in.spec.ts`

**Steps:**

1. On `/en/login`, enter Mona's number and password, press "Log in" - expect: the URL is `/en/admin` - expect: the heading greets Mona

#### 1.2. student-logs-in

**File:** `e2e/auth/student-logs-in.spec.ts`

**Steps:**

1. On `/en/login`, enter Sara's number and password, press "Log in" - expect: the URL is `/en/app` and the heading greets Sara

#### 1.3. persian-digits-are-accepted

**File:** `e2e/auth/persian-digits-are-accepted.spec.ts`

**Steps:**

1. On `/fa/login`, type Sara's number in Persian digits (`۰۹۱۲۰۰۰۰۰۰۲`) and the password, press "ورود" - expect: the URL is `/fa/app`

#### 1.4. wrong-password-keeps-phone

**File:** `e2e/auth/wrong-password-keeps-phone.spec.ts`

**Steps:**

1. Log in as Sara with a wrong password - expect: an alert says the number or password is incorrect - expect: the phone field still contains Sara's number - expect: still on the login page

#### 1.5. unknown-number-same-error

**File:** `e2e/auth/unknown-number-same-error.spec.ts`

**Steps:**

1. Log in with an unregistered number - expect: the same "incorrect" alert as a wrong password

#### 1.6. empty-fields-are-reported

**File:** `e2e/auth/empty-fields-are-reported.spec.ts`

**Steps:**

1. Press "Log in" with empty fields - expect: "Please fill in this field." is shown - expect: the phone field is marked `aria-invalid`

#### 1.7. repeated-failures-lock-the-number

**File:** `e2e/auth/repeated-failures-lock-the-number.spec.ts`

**Steps:**

1. Fail to log in as Sara five times - expect: each attempt shows the "incorrect" alert
2. Log in with the correct password - expect: the "too many attempts" alert

#### 1.8. unactivated-account-cannot-log-in

**File:** `e2e/auth/unactivated-account-cannot-log-in.spec.ts`

**Steps:**

1. Create a user without a password; try to log in with any password - expect: the "incorrect" alert

#### 1.9. deactivated-account-cannot-log-in

**File:** `e2e/auth/deactivated-account-cannot-log-in.spec.ts`

**Steps:**

1. Create a deactivated user with a password; log in with it - expect: the "incorrect" alert

#### 1.10. logout-ends-the-session

**File:** `e2e/auth/logout-ends-the-session.spec.ts`

**Steps:**

1. Log in as Mona, press "Log out" - expect: the URL is `/en/login`
2. Open `/en/admin` - expect: redirected to `/en/login?next=%2Fadmin`

### 2. Access rules

**Seed:** `e2e/seed.spec.ts`

#### 2.1. protected-page-returns-after-login

**File:** `e2e/access/protected-page-returns-after-login.spec.ts`

**Steps:**

1. Open `/en/admin` while logged out - expect: redirected to `/en/login?next=%2Fadmin`
2. Log in as Mona on that page - expect: the URL is `/en/admin`

#### 2.2. student-cannot-open-admin

**File:** `e2e/access/student-cannot-open-admin.spec.ts`

**Steps:**

1. Log in as Sara, then open `/en/admin` - expect: redirected to `/en/app`

#### 2.3. next-cannot-escalate-or-leave-site

**File:** `e2e/access/next-cannot-escalate-or-leave-site.spec.ts`

**Steps:**

1. Log in as Sara via `/en/login?next=%2Fadmin` - expect: the URL is `/en/app`
2. Log out; log in as Mona via `/en/login?next=%2F%2Fevil.example` - expect: the URL is `/en/admin`

#### 2.4. forged-session-cookie-is-rejected

**File:** `e2e/access/forged-session-cookie-is-rejected.spec.ts`

**Steps:**

1. Set a made-up `molingo_session` cookie, open `/en/admin` - expect: redirected to `/en/login`

#### 2.5. logged-in-user-skips-login-page

**File:** `e2e/access/logged-in-user-skips-login-page.spec.ts`

**Steps:**

1. Log in as Mona, then open `/en/login` - expect: redirected to `/en/admin`

# Security Headers Test Plan

## Application Overview

Every response carries security headers: a Content-Security-Policy limiting scripts, styles, fonts,
images and connections to our own origin (no third parties), a Permissions-Policy that allows the
camera/microphone/screen only for us and blocks geolocation/payment, no framing, `nosniff`, and a strict
referrer policy. Pages must still work under the policy: no CSP violations while using them.

## Test Scenarios

### 1. Security headers

**Seed:** `e2e/seed.spec.ts`

#### 1.1. pages-send-security-headers

**File:** `e2e/security/pages-send-security-headers.spec.ts`

**Steps:**

1. Open `/fa` and `/en/login` - expect: `Content-Security-Policy` allows only `'self'` for default/fonts/connections, forbids
   objects and framing - expect: `Permissions-Policy` allows camera and microphone for self and disables geolocation - expect: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
   `Referrer-Policy: strict-origin-when-cross-origin`

#### 1.2. pages-work-without-csp-violations

**File:** `e2e/security/pages-work-without-csp-violations.spec.ts`

**Steps:**

1. Open the home page, switch language, open the login page, log in as Sara - expect: the student dashboard is reached - expect: the browser reported no CSP violations on any page

# Installable Web App Test Plan

## Application Overview

M12: Hoopo installs from Android Chrome and iOS Safari ("Add to Home Screen"). A web manifest
(`/manifest.webmanifest`, Hoopo icons, standalone, navy theme) and a service worker (`/sw.js`,
production only) cache the app shell: hashed build files and fonts, never pages, API responses or
uploads. With no network, a page navigation shows `/offline.html` (Persian and English).

## Test Scenarios

### 1. Install and offline

**Seed:** `e2e/seed.spec.ts`

#### 1.1. manifest-and-offline-page

**File:** `e2e/pwa/installable-offline.spec.ts`

**Steps:**

1. Open `/en` - expect: a manifest link whose JSON is standalone with at least three icons
2. Wait for the service worker, reload - expect: the worker controls the page
3. Go offline and open `/en/login` - expect: the offline page ("اینترنت وصل نیست")

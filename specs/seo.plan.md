# Search Engines Test Plan

## Application Overview

Public pages are discoverable and signed-in areas are not: `/robots.txt` (disallows admin, app,
owner, login, token and API paths; points to the sitemap), `/sitemap.xml` (every teacher page in
both languages with alternates), and per-page metadata: canonical, hreflang with `x-default`, Open
Graph and Twitter tags (`/og-fa.png`, `/og-en.png`), JSON-LD. The platform home page stays
`noindex` and out of the sitemap while it shows [X]/[Y]/[Z] placeholders (`platformHomeReady` in
`src/lib/site.ts`).

## Test Scenarios

### 1. Public pages

**Seed:** `e2e/seed.spec.ts`

#### 1.1. public-pages-for-search

**File:** `e2e/seo/public-pages-for-search.spec.ts`

**Steps:**

1. Fetch `/robots.txt` - expect: `Disallow: /*/admin` and a Sitemap line
2. Fetch `/sitemap.xml` - expect: `/fa/mona` and `/en/mona`
3. Open `/en/mona` - expect: canonical, hreflang fa and x-default, og:image `og-en.png`, an
   `EducationalOrganization` JSON-LD block
4. Open `/en/nobody-here` - expect: `noindex`

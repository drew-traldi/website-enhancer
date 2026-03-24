# Website Enhancer — Master Purpose Document

## Mission Statement

**Website Enhancer** is an internal sales automation platform for **HAI Custom Solutions LLC** ("HAI Consulting Services"). It discovers local businesses with outdated websites, automatically rebuilds modern versions of those sites, publishes them as live demos, and sends personalized sales emails — all orchestrated through a branded admin dashboard.

The philosophy: *"AI empowering people, not replacing them. Human creativity paired with AI ingenuity is going to change the world."*

---

## System Overview

### The Pipeline (5 Stages)

```
DISCOVER → FILTER → SCORE(+NARRATIVE) → REBUILD → OUTREACH
```

| Stage | Input | Output | Key Tech |
|-------|-------|--------|----------|
| **Discover** | City name (e.g. "Roswell, GA") | Raw list of local businesses | Google Places API (Nearby/Text Search) |
| **Filter** | Raw business list | Qualified prospects (non-chains, active, 2.5+ stars) | Chain detection algorithm, activity scoring |
| **Score** | Qualified prospect websites | Modernity score 1-10 per site | Puppeteer/Playwright, Lighthouse, custom heuristics |
| **Rebuild** | Lowest-scoring 15 websites | Modern rebuilt demos + narrative proposal pages + before/after screenshots | Cursor Agent (auto mode), Tailwind CSS, app-hosted dynamic demo routes |
| **Outreach** | Rebuilt sites + business contact info | Personalized sales emails with live demo links | SendGrid API, email template engine |

### Batch Logic

- Each city run produces **exactly 15 prospects** for rebuild
- If fewer than 15 score ≤ 4, take the 15 lowest scores regardless
- A **persistent database** tracks all previously processed businesses per city
- Subsequent runs for the same city pick up where the last one left off (businesses 16-30, 31-45, etc.)
- The system must guarantee **at minimum 15 new results per run** (if the city has enough businesses)

---

## Detailed Stage Specifications

### Stage 1: DISCOVER

**Goal:** Find all non-chain local businesses in a given city.

**Process:**
1. Accept city input (e.g., "Roswell, GA")
2. Geocode city to lat/lng coordinates
3. Query Google Places API using Text Search / Nearby Search across multiple business categories:
   - Restaurants, cafes, bars
   - Retail shops, boutiques
   - Professional services (lawyers, accountants, dentists, etc.)
   - Home services (plumbing, HVAC, landscaping, etc.)
   - Health & wellness (gyms, salons, spas)
   - Auto services
   - Other local services
4. Paginate through results to build comprehensive list
5. Store raw results in database with discovery timestamp

**Data Captured Per Business:**
- `name` — Business name
- `place_id` — Google Place ID (unique identifier)
- `address` — Full formatted address
- `city` — Parsed city name
- `lat` / `lng` — Coordinates
- `phone` — Phone number (if available)
- `website` — Website URL (if available)
- `google_rating` — Star rating (1-5)
- `google_review_count` — Total number of reviews
- `business_types` — Google place type categories
- `photos` — Photo references (for potential use)
- `hours` — Operating hours

**Chain Detection Algorithm:**
- Query Google Places API for the business name across a wider geographic area (50-mile radius, then statewide)
- If the exact business name appears in **11+ distinct locations**, flag as chain and exclude
- Businesses with **2-10 locations** are KEPT (small local chains are valid prospects)
- Known national chains list (supplementary): Maintain a curated list of ~500 known national chains (McDonald's, Starbucks, Walmart, etc.) for instant filtering
- Edge case: Franchises with local ownership but national branding (e.g., "Subway") → exclude via known chains list

### Stage 2: FILTER

**Goal:** Narrow to businesses that are (a) active, (b) have a website, and (c) worth pursuing.

**Filters Applied (in order):**
1. **Has website** — Must have a `website` URL in Google Places data. No website = skip.
2. **Minimum rating** — Google rating ≥ 2.5 stars
3. **Minimum reviews** — At least 5 Google reviews (signals real activity)
4. **Recent activity** — At least 1 Google review in the last 12 months
5. **Website is live** — HTTP HEAD request returns 200 (not 404, not domain parked)
6. **Not previously processed** — Not already in the database for this city
7. **Not a chain** — Passes chain detection from Stage 1

**Output:** Qualified prospect list stored in database with filter pass/fail reasons.

### Stage 3: SCORE — Website Modernity Assessment

**Goal:** Score each qualified prospect's website on a 1-10 modernity scale.

**Scoring Criteria (weighted):**

| Category | Weight | What's Checked |
|----------|--------|----------------|
| **Responsive Design** | 20% | Viewport meta tag, media queries, mobile rendering |
| **Visual Design Era** | 20% | Font stack analysis, color palette, layout patterns (tables vs flexbox/grid) |
| **Performance** | 15% | Lighthouse performance score, page weight, load time |
| **Security** | 10% | HTTPS, mixed content, security headers |
| **Accessibility** | 10% | Basic a11y (alt tags, heading structure, contrast) |
| **Technical Stack** | 10% | Modern frameworks detected, jQuery-only, inline styles, Flash |
| **Content Quality** | 10% | Image optimization, broken links, copyright date |
| **UX Patterns** | 5% | Navigation clarity, CTA presence, mobile hamburger menu |

**Score Interpretation:**
- **9-10:** Modern, well-built site — not a prospect
- **7-8:** Decent but could use improvement — low priority prospect
- **5-6:** Clearly dated but functional — medium prospect
- **3-4:** Significantly outdated — strong prospect
- **1-2:** Extremely outdated, possibly broken — prime prospect

**Technical Implementation:**
- Use Puppeteer/Playwright to render each site in headless Chrome
- Capture **full-page screenshot** of landing page (for before/after comparison)
- Run Lighthouse audit programmatically
- Custom heuristics for visual era detection:
  - Check for `<table>` used for layout (not data)
  - Check font-family declarations (Arial/Times = old, Google Fonts = newer)
  - Check for CSS Grid or Flexbox usage
  - Check for responsive images (`srcset`, `picture` element)
  - Check for jQuery vs modern JS
  - Check `<meta name="generator">` for old CMS versions
  - Check copyright year in footer
  - Check for Flash (`<object>`, `<embed>`)

**Batch Selection:**
- Sort all scored businesses by modernity score (ascending)
- Select the bottom 15 (lowest scores)
- If fewer than 15 score ≤ 4, still take the 15 lowest
- Mark selected businesses as "queued_for_rebuild" in database

### Stage 4: REBUILD — AI-Powered Website Redesign

**Goal:** Create a modern, visually stunning version of each prospect's website.

**Approach:**
- **Stack:** Static HTML + Tailwind CSS + vanilla JS generated per business; stored and served by the main Next.js app
- **Hosting (default):** Single Vercel deployment with dynamic routes:
  - `/demos/[slug]` → raw interactive rebuilt demo
  - `/proposal/[businessId]` → narrative sales story page with before/after and CTA
- **Why this approach:** Avoids creating/maintaining large numbers of GitHub repos/pages while keeping every demo instantly shareable.
- **Legacy fallback:** Existing GitHub Pages demos remain supported for transition only.

**Rebuild Process (per business):**
1. **Scrape original site** — Extract text content, images, color themes, logo, navigation structure
2. **Generate design brief** — AI analyzes the business type, original content, and creates a design direction
3. **Build with Cursor Agent** — Trigger Cursor in auto mode to:
   - Create a single-page modern landing page
   - Incorporate original business content (name, services, hours, contact info)
   - Use original images where quality permits, stock alternatives where needed
   - Apply modern design patterns appropriate to the business type
   - Include HAI branding watermark/banner
4. **HAI Watermark/Banner** — Every rebuilt site includes:
   - A persistent banner (top or bottom): *"This site redesign was created by HAI Custom Solutions — [Contact Us](https://www.haiconsultingservices.com/contact)"*
   - The banner should be tasteful, on-brand, and not obtrusive
5. **Publish to app-hosted demo routes** — Save generated HTML and metadata in database, expose via `/demos/[slug]`
6. **Generate narrative proposal page** — Build `/proposal/[businessId]` that frames the story with score findings + before/after proof
7. **Capture screenshot** — Take full-page screenshot of the rebuilt landing page (for the "after" in the email)

**Stored Per Rebuild (database-backed):**
```
rebuilds row:
├── demo_slug
├── demo_html (or demo_storage_path)
├── live_demo_url (/demos/[slug])
├── proposal_url (/proposal/[businessId])
└── screenshot_after_url
```

### Stage 5: OUTREACH — Personalized Sales Email

**Goal:** Send a compelling, personalized sales email to each prospect with before/after screenshots and a live demo link.

**Contact Info Discovery:**
1. Check Google Places data for email
2. Scrape the prospect's website for:
   - `mailto:` links
   - Contact page form (extract email if visible)
   - "Contact Us" / "About" / "Info" pages
3. Check common patterns: `info@domain.com`, `contact@domain.com`, `hello@domain.com`
4. If **no email found**: Flag for manual outreach — store in dashboard as "Manual Send" with the business website URL and phone number so the HAI Executive can visit in person or call

**Email Content:**
- **From:** The assigned HAI Executive (Drew, Savannah, Elliot, or Ian)
- **Subject line:** AI-generated, personalized to the business (e.g., "A fresh look for [Business Name]'s online presence")
- **Body includes:**
  - Personal greeting mentioning the business by name
  - Brief compliment about their business (reference star rating, reviews, what they do)
  - The pitch: "We noticed your website could use a refresh — so we built you one"
  - **Before screenshot** (original site landing page)
  - **After screenshot** (rebuilt site landing page)
  - **Narrative proposal link** (primary CTA)
  - **Raw interactive demo link** (secondary CTA)
  - CTA: "Let's chat about making this yours" → links to https://www.haiconsultingservices.com/contact
  - HAI Executive's signature block
- **Sent via:** SendGrid API (for delivery analytics — opens, clicks, bounces)

**Manual Outreach Fallback:**
- If no email address found: Dashboard shows the business with all available contact info
- HAI Executive can:
  - Enter an email manually and trigger send
  - Mark as "visited in person"
  - Mark as "called"
  - Mark as "skipped"

---

## Admin Dashboard

**Hosted on:** Vercel (its own deployment, separate from demo sites)
**Stack:** Next.js + Tailwind CSS + shadcn/ui components
**Auth:** Simple login — validates against 4 HAI Executives:
- **D** = Drew (CEO / Head of Client Relations)
- **S** = Savannah Owens (CRO)
- **E** = Elliot Kinney (COO)
- **I** = Ian Kinney (CIO)

Authentication is code-based (D/S/E/I + a shared PIN), not full OAuth. Simple and secure enough for 4 internal users.

### Dashboard Views

**1. Pipeline Overview (Home)**
- City selector / search
- Pipeline funnel visualization: Discovered → Scored → Narrative Crafted → Rebuilt → Emailed
- Quick stats: Total prospects, avg modernity score, emails sent, open rate, click rate

**2. Discovery Manager**
- Start new city run
- View all cities previously scanned
- See discovery status per city (how many batches run, total businesses found)

**3. Prospect List**
- Sortable/filterable table of all businesses
- Columns: Name, City, Rating, Reviews, Website, Modernity Score, Status, Assigned Executive
- Status badges: Discovered, Filtered, Scored, Rebuilding, Rebuilt, Email Sent, Manual Required, Responded, Converted, Skipped
- Click into any prospect for full detail view

**4. Prospect Detail**
- Business info card (name, address, phone, rating, reviews, website)
- Modernity score breakdown (radar chart showing each category)
- Before/After screenshot comparison (side by side)
- Narrative proposal link + live demo link
- Email status (sent, opened, clicked, replied)
- Contact info found + ability to manually add email
- Action buttons: Send Email, Resend, Mark as Manual, Assign Executive, Skip
- Notes field for the executive

**5. Email Analytics**
- Aggregate SendGrid stats
- Per-email tracking (open, click, bounce, reply)
- Filter by executive, city, date range

**6. Settings**
- Executive profiles (name, email, title, phone for signature blocks)
- SendGrid API key configuration
- Google API key configuration
- GitHub configuration (org, PAT for Pages deployment)
- Cursor integration settings
- Default email template editor

---

## Database Schema (PostgreSQL via Supabase or similar)

### Tables

**cities**
- `id` (UUID, PK)
- `name` (text) — e.g., "Roswell"
- `state` (text) — e.g., "GA"
- `lat` / `lng` (float)
- `last_run_at` (timestamp)
- `total_businesses_found` (int)
- `batches_completed` (int)

**businesses**
- `id` (UUID, PK)
- `city_id` (FK → cities)
- `place_id` (text, unique) — Google Place ID
- `name` (text)
- `address` (text)
- `phone` (text, nullable)
- `website` (text, nullable)
- `google_rating` (float)
- `google_review_count` (int)
- `latest_review_date` (date, nullable)
- `business_types` (text[])
- `is_chain` (boolean)
- `chain_location_count` (int, nullable)
- `is_active` (boolean) — passes activity filter
- `discovered_at` (timestamp)
- `batch_number` (int) — which batch this business was part of

**website_scores**
- `id` (UUID, PK)
- `business_id` (FK → businesses)
- `overall_score` (float, 1-10)
- `responsive_score` (float)
- `visual_era_score` (float)
- `performance_score` (float)
- `security_score` (float)
- `accessibility_score` (float)
- `tech_stack_score` (float)
- `content_quality_score` (float)
- `ux_score` (float)
- `details` (jsonb) — full breakdown data
- `screenshot_before_url` (text) — S3/Cloudflare R2 URL
- `scored_at` (timestamp)

**rebuilds**
- `id` (UUID, PK)
- `business_id` (FK → businesses)
- `demo_kind` (text) — `app_hosted` or `github_pages` (legacy fallback)
- `demo_slug` (text) — route slug for `/demos/[slug]`
- `demo_html` (text, nullable) — generated HTML payload for app-hosted demos
- `demo_storage_path` (text, nullable) — optional storage pointer if payload moved out of row
- `github_repo_url` (text)
- `live_demo_url` (text) — live demo URL (default `/demos/[slug]`)
- `proposal_url` (text) — narrative page URL (`/proposal/[businessId]`)
- `screenshot_after_url` (text)
- `design_brief` (jsonb) — AI-generated design direction
- `status` (enum: queued, building, deployed, failed)
- `built_at` (timestamp)

**outreach**
- `id` (UUID, PK)
- `business_id` (FK → businesses)
- `rebuild_id` (FK → rebuilds)
- `executive_id` (text) — D, S, E, or I
- `contact_email` (text, nullable)
- `contact_method` (enum: email, manual_email, in_person, phone, skipped)
- `email_subject` (text)
- `email_body` (text) — rendered HTML
- `sendgrid_message_id` (text, nullable)
- `sent_at` (timestamp, nullable)
- `opened_at` (timestamp, nullable)
- `clicked_at` (timestamp, nullable)
- `bounced` (boolean, default false)
- `status` (enum: draft, sent, opened, clicked, replied, converted, skipped)
- `notes` (text, nullable)

**executives**
- `id` (text, PK) — D, S, E, or I
- `full_name` (text)
- `title` (text)
- `email` (text)
- `phone` (text)
- `pin_hash` (text) — hashed PIN for dashboard auth

---

## Tech Stack Summary

| Component | Technology | Why |
|-----------|-----------|-----|
| Dashboard | Next.js 14 + Tailwind + shadcn/ui | Modern, fast, deploys to Vercel |
| Database | Supabase (PostgreSQL) | Free tier generous, real-time, hosted |
| Business Discovery | Google Places API (New) | Most comprehensive local business data |
| Website Scoring | Puppeteer + Lighthouse + custom | Full rendering + performance metrics |
| Screenshot Capture | Puppeteer | Before/after comparisons |
| Screenshot Storage | Supabase Storage or Cloudflare R2 | Cheap object storage |
| Website Rebuild | Cursor Agent (auto mode) | AI-powered code generation |
| Demo Hosting | Next.js dynamic demo routes on Vercel + Supabase | One deployment, no repo sprawl, scalable |
| Email Sending | SendGrid | Delivery analytics, templates, reliable |
| Email Discovery | Custom scraper (Cheerio/Puppeteer) | Extract contact emails from websites |
| Auth | Simple PIN-based (4 users) | Internal tool, low complexity |

---

## HAI Executive Profiles

| ID | Name | Title | Role in Pipeline |
|----|------|-------|-----------------|
| D | Drew | CEO / Head of Client Relations | Primary, oversees all |
| S | Savannah Owens | CRO (Chief Revenue Officer) | Sales outreach, revenue tracking |
| E | Elliot Kinney | COO (Chief Operating Officer) | Operations, process management |
| I | Ian Kinney | CIO (Chief Information Officer) | Technical oversight, integrations |

---

## Key Business Rules

1. **15 per run, always.** Every city run must produce exactly 15 rebuild candidates.
2. **No repeats.** The database prevents reprocessing businesses across runs.
3. **Lowest scores win.** If not enough ≤ 4, take the 15 lowest scores.
4. **Chain threshold: 11+ locations = chain.** 2-10 locations are kept as small local businesses.
5. **No email? No problem.** Flag for manual outreach — never skip a hot prospect just because email wasn't found.
6. **HAI branding on every demo.** Contact Us → https://www.haiconsultingservices.com/contact
7. **Executive assignment is manual** (via dashboard) unless auto-assigned by territory in a future version.
8. **SendGrid for all automated sends.** Track everything.
9. **Screenshots + narrative are gold.** Before/after proof plus a guided proposal story is the core sales collateral.
10. **Star ratings stored always.** Even if a business scores high on modernity, their Google data is valuable for future reference.

---

## Future Enhancements (Post-MVP)

- Territory-based auto-assignment of executives to cities
- A/B testing email subject lines via SendGrid
- Integration with CRM (HubSpot or similar)
- Client portal where prospects can approve and "go live" with their redesign
- Automated follow-up email sequences (Day 3, Day 7, Day 14)
- Social media presence scoring (Instagram followers, Facebook activity)
- Multi-page rebuilds (not just landing page)
- Cost estimation engine (auto-quote based on site complexity)
- White-label option for HAI partner agencies

---

## Development Phases

### Phase 1: Foundation & Discovery Engine
Project scaffolding, database setup, Google Places integration, chain detection, business filtering pipeline.

### Phase 2: Website Scoring Engine  
Puppeteer-based site analysis, Lighthouse integration, custom modernity heuristics, screenshot capture, scoring algorithm.

### Phase 3: Admin Dashboard
Next.js dashboard with auth, pipeline visualization, prospect management, executive assignment, city management.

### Phase 4: Rebuild Pipeline & Deployment
Cursor Agent integration, static site generation, app-hosted demo/proposal routing, before/after screenshot workflow.

### Phase 5: Outreach Engine
Email discovery, SendGrid integration, email template system, manual outreach workflow, analytics tracking.

---

*Document Version: 1.0*
*Created: March 2026*
*Owner: Drew — HAI Custom Solutions LLC*

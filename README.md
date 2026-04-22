# NYC Field Finder

A single-screen tool for finding open athletic fields across NYC Parks. Pick a
sport and a date range; get back every curated field with permit-free windows,
color-coded by day.

Built as a take-home exercise for M-Flat, Inc. (On-Site AI Consultant role).

**Live demo:** [nyc-field-finder.vercel.app](https://nyc-field-finder.vercel.app)
**Try locally:** `npm install && npm run dev` → [localhost:3000](http://localhost:3000)

---

## Why this tool exists

NYC's official permit-availability map
([nycgovparks.org/permits/field-and-court/map](https://www.nycgovparks.org/permits/field-and-court/map))
is pin-by-pin, date-by-date. For a youth-sports organization comparing open
windows across 20 fields × 2 weeks, it scales badly: hundreds of clicks, no way
to export, no cross-field view. This tool collapses all of that into one grid.

---

## How it works

```text
Browser (React UI)
        │  GET /api/availability?sport=Soccer&start=…&end=…
        ▼
Next.js API route (Node runtime)
        │  1. Map curated parks → per-park CSV URLs
        │  2. Fetch CSVs in parallel (concurrency 4, 10s timeout)
        │  3. In-memory cache, 1-hour TTL per park
        │  4. Parse → Permit objects, normalize sport names
        │  5. For each (field, day): booked intervals clipped to 6a–10p
        ▼
JSON  { sport, fields: [{ park, field, days: [{ date, booked[] }] }], … }
        │
        ▼
Heatmap (fields × days, hour-bar per cell, click for detail)
```

### The data source: per-park issued-permits CSVs

NYC Parks' map page has no documented API, but the "Field and Court Usage
Report" export — reachable at
`https://www.nycgovparks.org/permits/field-and-court/issued/<PARK_CODE>/csv` —
is a stable, public CSV of every issued permit at a park. Columns: start, end,
field, sport/event, event name, organization, status.

Given this, "availability" is just the inverse of issued permits clipped to an
operating window (6a–10p by default). One HTTP call per park covers a full
season of dates — dramatically cheaper than scraping the map's
field-by-field-by-datetime API, and politer.

### Architecture

- **`lib/parks.ts`** — Curated list of 15 parks across all 5 boroughs, each
  verified to return non-empty CSV data. Sport taxonomy (Soccer, Baseball, …)
  + a `normalizeSport` function that collapses CSV variants like
  `"Baseball - 12 and Under (Little League)"` into the Soccer/Baseball/… buckets
  the UI exposes.
- **`lib/nycParks.ts`** — `fetchPermitsForPark(code)` hits the CSV endpoint,
  parses with `papaparse`, and caches in-memory for 1 hour. `parseCsvDate`
  turns `"3/20/2026 4:00 p.m."` into a `Date`.
- **`lib/availability.ts`** — Pure function. Given permits + sport + date range
  + operating window, emits `FieldAvailability[]`. Handles:
  - permits that cross midnight (clipped per-day),
  - `Full Closure` / `Special Event` entries (block every sport, not just one),
  - fields where the sport has never been permitted (excluded from the result).
- **`app/api/availability/route.ts`** — Single GET endpoint. Validates inputs,
  caps date range at 30 days, fetches all parks in parallel, aggregates, and
  emits partial-success warnings if any park fetch fails.
- **`components/FieldGrid.tsx`** — The heatmap. Rows grouped by park;
  each row has a cell per day showing booked red segments on an emerald
  background. Clicking any cell opens a modal with explicit open windows and
  the permits blocking the rest.

---

## AI tools used (and where I chose not to)

### Claude Code (Opus 4.7) — primary driver

- Plan mode: drafted architecture, asked clarifying questions (effort level,
  stack, coverage, UX), identified FieldSpottr as a prior-art reference.
- Implementation: wrote `lib/*`, the API route, and the React components.
- Debugging: caught the NYC Parks CDN's non-browser UA rejection on the first
  local API call and proposed the Chrome UA fix.

### Claude web search + WebFetch — research

- Discovered the `/permits/field-and-court/issued/<code>/csv` URL pattern via
  indexed NYC Parks URLs and the public FieldSpottr repo.
- Pulled FieldSpottr's confirmed park codes (M144 East River, B058 McCarren,
  etc.) as a starting seed for the curated list.

### Where I stayed manual

- The 15-park curated list: I batch-probed ~40 park codes against the CSV
  endpoint, then hand-picked 15 across the five boroughs based on permit
  density (so demos are interesting) and geographic spread (so clients see
  citywide coverage). That's a product judgment, not a search problem.
- The heatmap UX decision (fields × days, hour-bar per cell) came from the
  brief's "decide from one screen" language, not from the tool.

**Rough time accounting:** ~15 min research, ~40 min scaffolding + code,
~10 min deploy + README. Running Claude in plan-first mode before any code
was the biggest leverage multiplier.

---

## Known limitations (and what I'd fix for production)

| Limitation | Why it exists | Production fix |
|---|---|---|
| **15 curated parks, not all 400+ NYC parks** | Scope control for a 1-hr build. Every one is verified live. | One-time script to discover every park code from the Mapbox vector tiles, commit to `lib/parks.ts`. Add borough-level filters in the UI. |
| **Availability = inverse of issued permits only.** A physical field closure or weather cancellation still shows "open". | No closures feed in the public CSV. | Add a manual overrides table (Postgres / KV) staff can edit; ingest the NYC Parks closures RSS if it exists. |
| **In-memory cache per serverless instance.** Cold starts re-fetch. | Zero-infra choice for the MVP. | Upstash Redis or Vercel KV, keyed by park+day, 24-hr TTL, warmed nightly via cron. |
| **Sport filter is string-matched against the CSV sport column.** Rare variants may mismatch. | Normalization is prefix-based; see `normalizeSport`. | Explicit alias table + unit tests per sport. |
| **No auth / no audit log.** Anyone with the URL can query. | MVP. | Vercel Password Protection or shared-link auth once a real client pilots it. |
| **Browser-style `User-Agent` to the CSV endpoint.** | NYC Parks' CloudFront WAF 403s anything that looks like a bot, including the honest `NycFieldFinder/0.1` UA I originally sent. | Reach out to NYC Parks DPR (they do respond) and request a documented bot UA or API credentials. For now, the 1-hr cache keeps traffic trivial. |
| **Fields with zero issued permits are invisible** (derivation-from-CSV limitation). | Curated inventory would fix this but costs build time. | Seed a per-park field inventory from the Mapbox tiles alongside the park-code expansion. |

---

## "Hardening for a real client" roadmap

1. **Persistent cache** (Upstash/Vercel KV) + nightly warmer cron for all parks.
2. **Full park inventory** via one-time scrape of Mapbox tiles; commit as data.
3. **Observability:** log `park, status, elapsed_ms` per upstream fetch; alert on 3 consecutive per-park failures.
4. **`.ics` export** per open slot so staff can drop it straight into a shared calendar.
5. **"Request permit" deep-link** that pre-fills the NYC Parks e-apply form with field + date + time.
6. **Saved searches** per staff member ("Soccer · this weekend · Brooklyn only").
7. **Borough / distance-from-office filters** in the sidebar.
8. **Printable weekly PDF** — one page, big text, for front-desk distribution.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

No environment variables required. The CSV endpoints are public.

### Poking at the API directly

```bash
curl 'http://localhost:3000/api/availability?sport=Soccer&start=2026-04-22&end=2026-04-28' | jq
```

Valid `sport` values: Soccer, Baseball, Softball, Basketball, Football,
Volleyball, Handball, Tennis, Cricket, Rugby, Lacrosse, Kickball, Track & Field,
Hockey, Bocce, Frisbee. Date range max = 30 days.

---

## Credits & thanks

- NYC Parks for publishing permit data as CSVs.
- [Zac Sweers' FieldSpottr](https://github.com/ZacSweers/FieldSpottr) — prior art that confirmed the CSV URL pattern and provided park-code seeds.

---

_Built April 2026 for the M-Flat take-home. Any field booked on this screen
still needs a real permit through NYC Parks._
